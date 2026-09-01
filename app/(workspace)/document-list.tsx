"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import type { WorkspaceMember } from "@/lib/auth/types";
import type { WorkspaceDocument } from "@/lib/documents/documents";

export type DocumentRow = WorkspaceDocument & {
  /** null when the creator's record is gone — a member the host removed, or one
   * from before members were persisted. Rendering a stale avatar would be a
   * guess; a blank cell is the truth. */
  creator: WorkspaceMember | null;
};

const COLUMNS = "grid-cols-[2.3fr_90px_110px_130px]";

// Pinned, not left to the runtime default: this list is rendered once on the
// server and again during hydration, and the container runs UTC while the people
// reading it do not. A timestamp near midnight would otherwise render as two
// different days and React would report a hydration mismatch. The workspace is a
// room full of people who are physically together, so one zone is the right
// model — it is theirs, not the server's.
const day = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  timeZone: "Asia/Seoul",
});
const stamp = (iso: string) => (iso ? day.format(new Date(iso)) : "—");

// Same input styling as `app/join/join-form.tsx`'s dialog, not reused directly
// — that form is a route apart and pulling shared constants in for two call
// sites is not worth the indirection yet.
const INPUT_BASE = "rounded-md border bg-paper-2 px-3 py-2 text-base text-ink";
const INPUT_OK = "border-ink";
const INPUT_BAD = "border-red-600";

/**
 * The workspace's documents (FR-020-06, the document half) and where UC-021's
 * 기본 흐름 starts.
 *
 * Rows navigate to `/documents/[id]`; "+ 새 문서" opens a `<dialog>` for the
 * one thing UC-021 asks for before creating one — a name — the same
 * `showModal()`-only-for-real-modality pattern `join-form.tsx` already uses,
 * not a second one invented for this file.
 *
 * Client-side for the search box and the dialog. The rows themselves arrive as
 * props from the server component, so the list is in the HTML on first paint.
 */
export function DocumentList({ documents }: { documents: Array<DocumentRow> }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return documents;
    return documents.filter((doc) => doc.name.toLowerCase().includes(needle));
  }, [documents, query]);

  function openDialog() {
    setName("");
    setError(null);
    dialogRef.current?.showModal();
    // showModal() moves focus to the dialog itself; the name field is what a
    // person actually wants to type into.
    requestAnimationFrame(() => nameRef.current?.focus());
  }

  async function create() {
    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(body.error ?? "문서를 만들지 못했습니다.");
        nameRef.current?.focus();
        return;
      }

      dialogRef.current?.close();
      // This page is a server component reading `readDocuments()` fresh per
      // request; refresh() is what makes going back to it show the new row
      // without a full reload.
      router.refresh();
      router.push(`/documents/${body.document.id}`);
    } catch {
      setError("서버에 연결할 수 없습니다.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-baseline gap-2.5">
        <h1 className="text-[22px] font-bold text-ink">문서</h1>
        <span className="font-mono text-[10px] tracking-wide text-ink-faint uppercase">
          {documents.length}개 항목 · 이 워크스페이스
        </span>
      </div>

      <div className="mb-4 flex items-center gap-2.5">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="제목으로 검색…"
          aria-label="문서 제목 검색"
          className="w-full max-w-95 rounded-md border border-ink bg-paper-2 px-3 py-1.5 text-[13px] text-ink placeholder:text-ink-faint"
        />
        <span className="flex-1" />
        <button
          type="button"
          onClick={openDialog}
          className="rounded-md border border-sky-deep bg-sky px-4 py-1.5 text-[13px] font-bold text-ink"
        >
          + 새 문서
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-ink">
        <div
          className={`grid ${COLUMNS} items-center border-b border-ink bg-paper-2 px-3.5 py-2 font-mono text-[9.5px] tracking-wide text-ink-soft uppercase`}
        >
          <span>Title</span>
          <span>만든 사람</span>
          <span>Modified ↓</span>
          <span>Created</span>
        </div>

        {rows.length === 0 ? (
          <p className="px-3.5 py-8 text-center text-[13px] text-ink-faint">
            {documents.length === 0
              ? "아직 문서가 없습니다."
              : `'${query}'와 일치하는 문서가 없습니다.`}
          </p>
        ) : (
          <ul>
            {rows.map((doc) => (
              <li
                key={doc.id}
                className="border-b border-dashed border-ink/15 last:border-b-0"
              >
                <Link
                  href={`/documents/${doc.id}`}
                  className={`grid ${COLUMNS} items-center px-3.5 py-2.5 hover:bg-paper-2`}
                >
                  <span className="truncate text-[13.5px] font-semibold text-ink">
                    {doc.name}
                  </span>
                  <span>
                    {doc.creator ? (
                      <span
                        title={doc.creator.nickname}
                        style={{ backgroundColor: doc.creator.colorTag }}
                        className="inline-flex size-5.5 items-center justify-center rounded-full border border-ink text-[11px] font-bold text-ink"
                      >
                        {doc.creator.nickname.slice(0, 1)}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-[13px] text-ink">{stamp(doc.updatedAt)}</span>
                  <span className="text-[13px] text-ink-soft">{stamp(doc.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <dialog
        ref={dialogRef}
        onCancel={(event) => {
          if (creating) event.preventDefault();
        }}
        className="m-auto max-w-sm rounded-lg border border-ink bg-paper p-5 text-ink backdrop:bg-ink/40"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
          className="flex flex-col gap-3"
        >
          <h2 className="text-base font-bold text-ink">새 문서</h2>
          <label className="flex flex-col gap-1 text-sm text-ink-soft">
            문서 이름
            <input
              ref={nameRef}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              aria-invalid={error !== null}
              className={`${INPUT_BASE} ${error ? INPUT_BAD : INPUT_OK}`}
            />
          </label>

          {error ? (
            <p role="alert" className="text-sm font-medium text-red-600">
              {error}
            </p>
          ) : null}

          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              disabled={creating}
              onClick={() => dialogRef.current?.close()}
              className="rounded-md border border-ink px-3 py-1.5 text-sm text-ink disabled:opacity-40"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={creating}
              className="rounded-md border border-sky-deep bg-sky px-3 py-1.5 text-sm font-bold text-ink disabled:opacity-40"
            >
              {creating ? "만드는 중…" : "만들기"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
