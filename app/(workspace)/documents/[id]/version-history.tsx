"use client";

import type { Client, Document } from "@yorkie-js/sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { BlockDocumentRoot } from "@/lib/blocks/document";
import { orderedListNumbers } from "@/lib/blocks/list-numbering";
import { readRevisionBlocks } from "@/lib/blocks/revision-snapshot";
import type { Block } from "@/lib/blocks/types";
import {
  REVISION_PAGE_SIZE,
  beforeRestoreLabel,
  groupRevisionsByDay,
  isOldestPage,
  reservedLabelReason,
  toRevisionEntries,
} from "@/lib/documents/revisions";
import type { RevisionEntry } from "@/lib/documents/revisions";

import { DIALOG, DIALOG_TITLE } from "../../ui";
import { HEADING_CLASS } from "./text-block";

/** What a document used to say, and putting it back (SOIR003). The mechanism —
 *  and why a restore is written here rather than handed to Yorkie — is
 *  `docs/design/version-history.md`. */

// The redesign's ghost and primary buttons (`docs/ui/redesign/HANDOFF.md` §3).
const BUTTON =
  "flex h-[30px] shrink-0 items-center gap-1.5 rounded-control px-2.5 text-[13.5px] font-medium text-ink-soft hover:bg-hover hover:text-ink disabled:opacity-40";
const PRIMARY =
  "h-8 shrink-0 rounded-control bg-ink px-3.5 text-[13.5px] font-semibold text-paper hover:opacity-90 disabled:bg-hover disabled:text-ink-faint disabled:hover:opacity-100";
const META = "text-xs text-ink-faint";

/** Same zone as every other timestamp in the workspace — `document-list.tsx`
 *  states why it is pinned rather than left to the machine. */
const TIME = new Intl.DateTimeFormat("ko-KR", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Seoul",
});

/** Stored labels are English and permanent; what a reader sees is chosen here. */
const KIND_LABEL = {
  automatic: "자동 저장",
  "before-restore": "복원 전",
  named: "수동 저장",
} as const;

/** The dialog's two jobs, mutually exclusive by construction — the shape
 *  `document-actions.tsx` uses for the same reason. */
type Prompt = { kind: "name" } | { kind: "restore"; entry: RevisionEntry };

export function VersionHistory({
  client,
  docRef,
  nickname,
  onRestore,
}: {
  client: Client;
  docRef: React.RefObject<Document<BlockDocumentRoot> | null>;
  /** Attached to a revision this browser creates, so a reader knows who named
   *  a version or triggered a restore without narrowing who may do either —
   *  `docs/design/version-history.md`, "Who may restore". */
  nickname: string;
  onRestore: (blocks: Array<Block>) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        className={`mt-2 ${BUTTON}`}
        onClick={() => setOpen((was) => !was)}
      >
        <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
          <circle cx="8" cy="8" r="5.5" />
          <path d="M8 5v3l2 1.5" />
        </svg>
        버전 히스토리
      </button>
      {/* Rendered only while open, so the fetch that fills it cannot land in a
          panel nobody asked for — the rule `editor.tsx`'s own overlays follow. */}
      {open ? (
        <HistoryPanel
          client={client}
          docRef={docRef}
          nickname={nickname}
          onClose={() => setOpen(false)}
          onRestore={onRestore}
        />
      ) : null}
    </>
  );
}

function HistoryPanel({
  client,
  docRef,
  nickname,
  onClose,
  onRestore,
}: {
  client: Client;
  docRef: React.RefObject<Document<BlockDocumentRoot> | null>;
  nickname: string;
  onClose: () => void;
  onRestore: (blocks: Array<Block>) => void;
}) {
  const [entries, setEntries] = useState<Array<RevisionEntry> | null>(null);
  const [oldestReached, setOldestReached] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Automatic revisions outnumber the rest by a wide margin — Yorkie takes one
  // every 500 changes — so the list opens on the ones a person chose.
  const [includeAutomatic, setIncludeAutomatic] = useState(false);
  const [selected, setSelected] = useState<RevisionEntry | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [busy, setBusy] = useState(false);

  const loadPage = useCallback(
    async (offset: number) => {
      const doc = docRef.current;
      if (!doc) return;

      setLoading(true);
      setError(null);
      try {
        const page = await client.listRevisions(doc, {
          pageSize: REVISION_PAGE_SIZE,
          offset,
        });
        setOldestReached(isOldestPage(page));
        setEntries((held) => toRevisionEntries([...(held ?? []), ...page]));
      } catch {
        setError("버전 목록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    },
    [client, docRef],
  );

  useEffect(() => {
    void loadPage(0);
  }, [loadPage]);

  const reload = useCallback(() => {
    setEntries(null);
    setOldestReached(false);
    setSelected(null);
    void loadPage(0);
  }, [loadPage]);

  /** The scaffold `createNamed` and `restore` both need: resolve the attached
   *  document, mark busy, close the prompt and refresh the list on success,
   *  show `errorMessage` on any failure. Each caller supplies only what makes
   *  it different — the work itself and its own error string. */
  const withBusy = useCallback(
    async (run: (doc: Document<BlockDocumentRoot>) => Promise<void>, errorMessage: string) => {
      const doc = docRef.current;
      if (!doc) return;

      setBusy(true);
      try {
        await run(doc);
        setPrompt(null);
        reload();
      } catch {
        setError(errorMessage);
      } finally {
        setBusy(false);
      }
    },
    [docRef, reload],
  );

  /** Names the document as it stands. Syncs first: a revision records what the
   *  server knows, so an unsynced call stores an empty snapshot and nothing
   *  reports it (`docs/design/version-history.md`). The description carries
   *  the actor's nickname, not a sentence — stored data stays raw, the Korean
   *  a reader sees is composed at render time, same as label classification. */
  const createNamed = useCallback(
    (label: string) =>
      withBusy(async (doc) => {
        await client.sync();
        await client.createRevision(doc, label, nickname);
      }, "버전을 저장하지 못했습니다."),
    [client, nickname, withBusy],
  );

  /**
   * Fetch and parse the target first, then take the undo-me revision, then
   * apply. Order is the whole point: a revision cannot be deleted, so a
   * "before restore" one left behind by a restore that then failed to fetch or
   * parse is permanent litter in the list. Parsing first also means the only
   * thing left after `createRevision` succeeds is a local write that cannot
   * fail — an irreversible restore is worse than none.
   *
   * This is deliberately *not* parallelised. `getRevision` really is
   * independent of `sync`/`createRevision` and overlapping them would save a
   * round trip, but `Promise.all` cannot cancel the revision-creating branch
   * once the fetch fails, which is the case this ordering exists to prevent.
   *
   * Open to everyone, not just the host: a guest can already replace every
   * block by hand, so restoring grants no capability they lack, and the
   * before-restore revision this call creates makes a wrong restore exactly as
   * reversible as a right one. Attribution — who did it — comes from the
   * description here, not from narrowing who is allowed to press the button.
   */
  const restore = useCallback(
    (entry: RevisionEntry) =>
      withBusy(async (doc) => {
        const full = await client.getRevision(doc, entry.id);
        const blocks = readRevisionBlocks(full.snapshot);

        await client.sync();
        await client.createRevision(doc, beforeRestoreLabel(entry.id), nickname);

        onRestore(blocks);
      }, "복원하지 못했습니다. 문서는 그대로입니다."),
    [client, nickname, onRestore, withBusy],
  );

  /** This panel is a plain overlay, not a `<dialog>`, so it has no native
   *  Escape handling of its own — same pattern as `document-row-menu.tsx`.
   *  Skipped while `prompt` is open: the nested `<dialog>` already closes
   *  itself on Escape (native `cancel`), and firing both at once would close
   *  two layers on one keypress. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || prompt) return;
      onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [prompt, onClose]);

  // Recomputed only when the list or the filter changes, not on every render
  // this panel has — `selected`/`busy`/`prompt` change far more often.
  const { shown, days } = useMemo(() => {
    const shown = (entries ?? []).filter(
      (entry) => includeAutomatic || entry.kind !== "automatic",
    );
    return { shown, days: groupRevisionsByDay(shown) };
  }, [entries, includeAutomatic]);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-scrim p-6">
      <section
        aria-label="버전 히스토리"
        className="flex h-full max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-card bg-elev shadow-elev"
      >
        <div className="flex h-[46px] flex-none items-center gap-1 border-b border-line pr-2 pl-4">
          <span className="font-semibold text-ink">버전 히스토리</span>
          <span className="flex-1" />
          <label className="mr-1 flex items-center gap-1.5 text-[13px] text-ink-soft">
            <input
              type="checkbox"
              checked={includeAutomatic}
              onChange={(event) => setIncludeAutomatic(event.target.checked)}
            />
            자동 저장 포함
          </label>
          {/* The panel has no live subscription — a revision another tab or
              person creates while this is open needs a manual pull. */}
          <button type="button" disabled={loading} className={BUTTON} onClick={reload}>
            새로고침
          </button>
          <button type="button" className={BUTTON} onClick={() => setPrompt({ kind: "name" })}>
            수동 저장
          </button>
          <button type="button" aria-label="버전 히스토리 닫기" className={BUTTON} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="w-72 flex-none overflow-y-auto border-r border-line p-2">
            {error ? (
              <p role="alert" className="px-3 py-4 text-[13px] font-medium text-danger">
                {error}
              </p>
            ) : null}

            {entries === null && loading ? (
              <p className="px-3 py-8 text-center text-[13px] text-ink-faint">여는 중…</p>
            ) : null}

            {entries !== null && shown.length === 0 ? (
              <p className="px-3 py-8 text-center text-[13px] text-ink-faint">
                {includeAutomatic
                  ? "아직 버전이 없습니다."
                  : "이름을 지정한 버전이 없습니다."}
              </p>
            ) : null}

            {days.map((day) => (
              <div key={day.day}>
                <p className={`sticky top-0 bg-elev px-2.5 pt-2 pb-1 font-semibold ${META}`}>{day.day}</p>
                {day.entries.map((entry) => (
                  <button
                    type="button"
                    key={entry.id}
                    onClick={() => setSelected(entry)}
                    className={`flex w-full gap-2.5 rounded-control p-2.5 text-left ${
                      selected?.id === entry.id ? "bg-sky-soft" : "hover:bg-hover"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${
                        selected?.id === entry.id ? "bg-sky-deep" : "bg-line-strong"
                      }`}
                    />
                    <span className="flex min-w-0 flex-col gap-0.5">
                    <span
                      className={`truncate text-[14px] font-semibold ${
                        selected?.id === entry.id ? "text-sky-text" : "text-ink"
                      }`}
                    >
                      {titleOf(entry)}
                    </span>
                    <span className={`text-[12.5px] ${META}`}>
                      {TIME.format(entry.createdAt)} · {KIND_LABEL[entry.kind]}
                      {/* Yorkie's own description ("Auto created revision of
                          snapshot #N") is not attribution — only a person's
                          own revisions carry a nickname worth showing. */}
                      {entry.kind !== "automatic" && entry.description
                        ? ` · ${entry.description}`
                        : ""}
                    </span>
                    </span>
                  </button>
                ))}
              </div>
            ))}

            {entries !== null && !oldestReached ? (
              <button
                type="button"
                disabled={loading}
                className={`m-3 ${BUTTON}`}
                onClick={() => void loadPage(entries.length)}
              >
                {loading ? "불러오는 중…" : "더 보기"}
              </button>
            ) : null}

            {entries !== null && oldestReached && shown.length > 0 ? (
              <p className="px-3 py-3 text-center text-xs text-ink-faint">
                가장 오래된 버전입니다.
              </p>
            ) : null}
          </div>

          <Preview
            key={selected?.id ?? "none"}
            client={client}
            docRef={docRef}
            entry={selected}
            busy={busy}
            onAskRestore={(entry) => setPrompt({ kind: "restore", entry })}
          />
        </div>
      </section>

      {prompt ? (
        <PromptDialog
          prompt={prompt}
          busy={busy}
          onCancel={() => setPrompt(null)}
          onName={createNamed}
          onRestore={restore}
        />
      ) : null}
    </div>
  );
}

/** A named revision shows its own label; the other two kinds have no name a
 *  person wrote, so they are described instead. */
function titleOf(entry: RevisionEntry): string {
  if (entry.kind === "named") return entry.label;
  if (entry.kind === "automatic") return "자동 저장";

  // `kind` alone disambiguates a before-restore entry — every such label came
  // from `beforeRestoreLabel(entry.id)` with a real id, so there is no case to
  // fall back from.
  return "복원 직전 상태";
}

/** The selected revision, read-only. Not the editor's block views: all six of
 *  those are bound to the live document — `TextBlockView` writes through its own
 *  `doc.update()` — so reusing them would mean giving them a read-only mode
 *  they have no other need for. */
function Preview({
  client,
  docRef,
  entry,
  busy,
  onAskRestore,
}: {
  client: Client;
  docRef: React.RefObject<Document<BlockDocumentRoot> | null>;
  entry: RevisionEntry | null;
  busy: boolean;
  onAskRestore: (entry: RevisionEntry) => void;
}) {
  const [blocks, setBlocks] = useState<Array<Block> | null>(null);
  const [failed, setFailed] = useState(false);

  // Keyed on the revision by the caller, so selecting another one remounts this
  // and both states start over — no reset to write, and a fetch that resolves
  // after the reader moved on lands in a component nobody is rendering.
  useEffect(() => {
    const doc = docRef.current;
    if (!entry || !doc) return;

    let cancelled = false;
    void client
      .getRevision(doc, entry.id)
      .then((full) => {
        if (!cancelled) setBlocks(readRevisionBlocks(full.snapshot));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [client, docRef, entry]);

  if (!entry) {
    return (
      <p className="flex flex-1 items-center justify-center text-[13px] text-ink-faint">
        버전을 선택하면 내용을 볼 수 있습니다.
      </p>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-[46px] flex-none items-center gap-2 border-b border-line px-4">
        <span className="truncate font-semibold text-ink">{titleOf(entry)}</span>
        <span className="flex-1" />
        {/* Open to everyone, not host-gated — `docs/design/version-history.md`,
            "Who may restore". The before-restore revision `restore()` creates
            is what makes this safe to leave open. */}
        <button
          type="button"
          disabled={busy || blocks === null || blocks.length === 0}
          className={PRIMARY}
          onClick={() => onAskRestore(entry)}
        >
          이 버전으로 복원
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {failed ? (
          <p role="alert" className="text-[13px] font-medium text-danger">
            이 버전의 내용을 읽지 못했습니다.
          </p>
        ) : blocks === null ? (
          <p className="text-[13px] text-ink-faint">여는 중…</p>
        ) : blocks.length === 0 ? (
          <p className="text-[13px] text-ink-faint">이 버전은 비어 있습니다.</p>
        ) : (
          <PreviewBlocks blocks={blocks} />
        )}
      </div>
    </div>
  );
}

function PreviewBlocks({ blocks }: { blocks: Array<Block> }) {
  const numbers = orderedListNumbers(blocks);

  return (
    <div className="flex flex-col gap-1.5">
      {blocks.map((block, index) => (
        <PreviewBlock key={block.id} block={block} number={numbers[index]} />
      ))}
    </div>
  );
}

function PreviewBlock({ block, number }: { block: Block; number: number }) {
  switch (block.type) {
    case "heading":
      return <p className={`text-ink ${HEADING_CLASS[block.level]}`}>{block.text}</p>;

    case "text":
      return <p className="text-[15px] leading-[1.7] whitespace-pre-wrap text-ink">{block.text}</p>;

    case "quote":
      return (
        <p className="border-l-[3px] border-line-strong pl-3.5 text-[15px] leading-[1.7] whitespace-pre-wrap text-ink-soft">
          {block.text}
        </p>
      );

    case "code":
      return (
        <pre className="overflow-x-auto rounded-control bg-paper-2 px-3 py-2 font-mono text-[13px] text-ink">
          {block.text}
        </pre>
      );

    case "list":
      return (
        <p
          className="text-[13px] whitespace-pre-wrap text-ink"
          style={{ paddingLeft: block.depth * 18 }}
        >
          {block.style === "ordered" ? `${number}. ` : "• "}
          {block.text}
        </p>
      );

    case "checklist":
      return (
        <p className="text-[13px] whitespace-pre-wrap text-ink">
          {block.checked ? "☑ " : "☐ "}
          {block.text}
        </p>
      );

    case "divider":
      return <hr className="my-2 border-line" />;

    // The bytes are not fetched for a preview — a past version's point is what
    // it said, and a file block says its name.
    case "file":
    case "image":
    case "pdf":
      return (
        <p className="text-[13px] text-ink-soft">
          📎 {block.fileName || "이름 없는 파일"}
        </p>
      );

    case "doc-link":
      return <p className="text-[15px] text-sky-text">문서 링크</p>;

    case "block-link":
      return <p className="text-[15px] text-sky-text">블록 링크</p>;
  }
}

/** `<dialog>` is only modal through `showModal()`, which has no declarative
 *  equivalent — the same effect `document-actions.tsx` runs for the same reason. */
function PromptDialog({
  prompt,
  busy,
  onCancel,
  onName,
  onRestore,
}: {
  prompt: Prompt;
  busy: boolean;
  onCancel: () => void;
  onName: (label: string) => void;
  onRestore: (entry: RevisionEntry) => void;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const [label, setLabel] = useState("");

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const restoring = prompt.kind === "restore";
  const trimmed = label.trim();
  // Checked as they type, not on submit — the name is permanent once stored,
  // so the refusal should arrive before the button looks pressable.
  const reserved = trimmed === "" ? null : reservedLabelReason(trimmed);

  return (
    <dialog
      ref={ref}
      className={DIALOG}
      onCancel={(event) => {
        if (busy) event.preventDefault();
        else onCancel();
      }}
    >
      {restoring ? (
        <>
          <p className={DIALOG_TITLE}>이 버전으로 복원할까요?</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            지금 문서는 <strong>복원 전</strong> 버전으로 먼저 저장되므로 되돌릴 수 있습니다.
            복원은 함께 보고 있는 모든 사람에게 반영됩니다.
          </p>
        </>
      ) : (
        <>
          <p className={DIALOG_TITLE}>지금 상태를 수동으로 저장할까요?</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            나중에 알아볼 수 있게 이름을 붙여 주세요. 한번 저장하면 이름은 바꾸거나 지울 수 없습니다.
          </p>
          <input
            autoFocus
            value={label}
            maxLength={60}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="예: 제출 전 최종"
            className="mt-3 h-[38px] w-full rounded-control border border-line-strong bg-elev px-3 text-[14.5px] text-ink outline-none focus:border-sky-deep focus:ring-3 focus:ring-sky-ring"
          />
          {reserved ? (
            <p role="alert" className="mt-2 text-[13px] text-danger">
              {reserved}
            </p>
          ) : null}
        </>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" disabled={busy} className={BUTTON} onClick={onCancel}>
          취소
        </button>
        <button
          type="button"
          disabled={busy || (!restoring && (trimmed === "" || reserved !== null))}
          className={PRIMARY}
          onClick={() => (restoring ? onRestore(prompt.entry) : onName(trimmed))}
        >
          {busy ? "처리 중…" : restoring ? "복원" : "저장"}
        </button>
      </div>
    </dialog>
  );
}
