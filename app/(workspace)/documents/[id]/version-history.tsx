"use client";

import type { Client, Document } from "@yorkie-js/sdk";
import { useCallback, useEffect, useRef, useState } from "react";

import type { BlockDocumentRoot } from "@/lib/blocks/document";
import { orderedListNumbers } from "@/lib/blocks/list-numbering";
import { readRevisionBlocks } from "@/lib/blocks/revision-snapshot";
import type { Block } from "@/lib/blocks/types";
import {
  REVISION_PAGE_SIZE,
  beforeRestoreLabel,
  groupRevisionsByDay,
  isOldestPage,
  restoredFrom,
  toRevisionEntries,
} from "@/lib/documents/revisions";
import type { RevisionEntry } from "@/lib/documents/revisions";

/** What a document used to say, and putting it back (SOIR003). The mechanism —
 *  and why a restore is written here rather than handed to Yorkie — is
 *  `docs/design/version-history.md`. */

const BUTTON =
  "rounded-md border border-ink px-2.5 py-1 font-mono text-[11px] font-medium text-ink disabled:opacity-40";
const PRIMARY =
  "rounded-md border border-sky-deep bg-sky px-2.5 py-1 font-mono text-[11px] font-bold text-ink disabled:opacity-40";
const DIALOG =
  "m-auto max-w-sm rounded-lg border border-ink bg-paper p-5 text-ink backdrop:bg-ink/40";
const META = "font-mono text-[10px] tracking-wide uppercase text-ink-faint";

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
  named: "이름 지정",
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
        className={BUTTON}
        onClick={() => setOpen((was) => !was)}
      >
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

  /** Names the document as it stands. Syncs first: a revision records what the
   *  server knows, so an unsynced call stores an empty snapshot and nothing
   *  reports it (`docs/design/version-history.md`). The description carries
   *  the actor's nickname, not a sentence — stored data stays raw, the Korean
   *  a reader sees is composed at render time, same as label classification. */
  const createNamed = useCallback(
    async (label: string) => {
      const doc = docRef.current;
      if (!doc) return;

      setBusy(true);
      try {
        await client.sync();
        await client.createRevision(doc, label, nickname);
        setPrompt(null);
        reload();
      } catch {
        setError("버전을 저장하지 못했습니다.");
      } finally {
        setBusy(false);
      }
    },
    [client, docRef, nickname, reload],
  );

  /**
   * Takes the undo-me revision first, then writes the old blocks back. If the
   * first call fails the restore is abandoned: an irreversible restore is
   * worse than none.
   *
   * Open to everyone, not just the host: a guest can already replace every
   * block by hand, so restoring grants no capability they lack, and the
   * before-restore revision this call creates makes a wrong restore exactly as
   * reversible as a right one. Attribution — who did it — comes from the
   * description here, not from narrowing who is allowed to press the button.
   */
  const restore = useCallback(
    async (entry: RevisionEntry) => {
      const doc = docRef.current;
      if (!doc) return;

      setBusy(true);
      try {
        await client.sync();
        await client.createRevision(doc, beforeRestoreLabel(entry.id), nickname);

        const full = await client.getRevision(doc, entry.id);
        onRestore(readRevisionBlocks(full.snapshot));
        setPrompt(null);
        reload();
      } catch {
        setError("복원하지 못했습니다. 문서는 그대로입니다.");
      } finally {
        setBusy(false);
      }
    },
    [client, docRef, nickname, onRestore, reload],
  );

  const shown = (entries ?? []).filter(
    (entry) => includeAutomatic || entry.kind !== "automatic",
  );
  const days = groupRevisionsByDay(shown);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 p-6">
      <section
        aria-label="버전 히스토리"
        className="flex h-full max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-ink bg-paper"
      >
        <div className="flex h-9 flex-none items-center gap-2 border-b border-ink px-3">
          <span className={META}>버전 히스토리</span>
          <span className="flex-1" />
          <label className="flex items-center gap-1.5 text-[11px] text-ink-soft">
            <input
              type="checkbox"
              checked={includeAutomatic}
              onChange={(event) => setIncludeAutomatic(event.target.checked)}
            />
            자동 저장 포함
          </label>
          <button type="button" className={BUTTON} onClick={() => setPrompt({ kind: "name" })}>
            이름 지정
          </button>
          <button type="button" aria-label="버전 히스토리 닫기" className={BUTTON} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="w-64 flex-none overflow-y-auto border-r border-ink">
            {error ? (
              <p role="alert" className="px-3 py-4 text-[13px] font-medium text-red-600">
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
                <p className={`sticky top-0 bg-paper-2 px-3 py-1 ${META}`}>{day.day}</p>
                {day.entries.map((entry) => (
                  <button
                    type="button"
                    key={entry.id}
                    onClick={() => setSelected(entry)}
                    className={`block w-full border-b border-ink/10 px-3 py-2 text-left ${
                      selected?.id === entry.id ? "bg-sky-soft" : ""
                    }`}
                  >
                    <span className="block truncate text-[13px] text-ink">
                      {titleOf(entry)}
                    </span>
                    <span className={META}>
                      {TIME.format(entry.createdAt)} · {KIND_LABEL[entry.kind]}
                      {/* Yorkie's own description ("Auto created revision of
                          snapshot #N") is not attribution — only a person's
                          own revisions carry a nickname worth showing. */}
                      {entry.kind !== "automatic" && entry.description
                        ? ` · ${entry.description}`
                        : ""}
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
              <p className="px-3 py-3 text-center text-[11px] text-ink-faint">
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

  const target = restoredFrom(entry.label);
  return target ? "복원 직전 상태" : "복원 전";
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
      <div className="flex h-9 flex-none items-center gap-2 border-b border-ink px-3">
        <span className="truncate text-[13px] font-semibold text-ink">{titleOf(entry)}</span>
        <span className="flex-1" />
        {/* Open to everyone, not host-gated — `docs/design/version-history.md`,
            "Who may restore". The before-restore revision `restore()` creates
            is what makes this safe to leave open. */}
        <button
          type="button"
          disabled={busy || blocks === null}
          className={PRIMARY}
          onClick={() => onAskRestore(entry)}
        >
          이 버전으로 복원
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {failed ? (
          <p role="alert" className="text-[13px] font-medium text-red-600">
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

const HEADING_SIZE = { 1: "text-[19px]", 2: "text-[16px]", 3: "text-[14px]" } as const;

function PreviewBlock({ block, number }: { block: Block; number: number }) {
  switch (block.type) {
    case "heading":
      return (
        <p className={`font-bold text-ink ${HEADING_SIZE[block.level]}`}>{block.text}</p>
      );

    case "text":
      return <p className="text-[13px] whitespace-pre-wrap text-ink">{block.text}</p>;

    case "quote":
      return (
        <p className="border-l-2 border-ink/30 pl-2 text-[13px] whitespace-pre-wrap text-ink-soft">
          {block.text}
        </p>
      );

    case "code":
      return (
        <pre className="overflow-x-auto rounded bg-paper-2 p-2 font-mono text-[12px] text-ink">
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
      return <hr className="border-ink/20" />;

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
      return <p className="text-[13px] text-sky-deep">🔗 문서 링크</p>;

    case "block-link":
      return <p className="text-[13px] text-sky-deep">🔗 블록 링크</p>;
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
          <p className="text-sm font-semibold text-ink">이 버전으로 복원할까요?</p>
          <p className="mt-2 text-[13px] text-ink-soft">
            지금 문서는 <strong>복원 전</strong> 버전으로 먼저 저장되므로 되돌릴 수 있습니다.
            복원은 함께 보고 있는 모든 사람에게 반영됩니다.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold text-ink">이 버전에 이름 지정</p>
          <p className="mt-2 text-[13px] text-ink-soft">
            이름은 나중에 바꾸거나 지울 수 없습니다.
          </p>
          <input
            autoFocus
            value={label}
            maxLength={60}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="예: 제출 전 최종"
            className="mt-3 w-full rounded-md border border-ink bg-paper px-2 py-1 text-[13px] text-ink"
          />
        </>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" disabled={busy} className={BUTTON} onClick={onCancel}>
          취소
        </button>
        <button
          type="button"
          disabled={busy || (!restoring && label.trim() === "")}
          className={PRIMARY}
          onClick={() =>
            restoring ? onRestore(prompt.entry) : onName(label.trim())
          }
        >
          {busy ? "처리 중…" : restoring ? "복원" : "저장"}
        </button>
      </div>
    </dialog>
  );
}
