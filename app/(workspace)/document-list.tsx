"use client";

import { useMemo, useState } from "react";

import type { WorkspaceMember } from "@/lib/auth/types";
import type { WorkspaceDocument } from "@/lib/documents/documents";

export type DocumentRow = WorkspaceDocument & {
  /** null when the creator's record is gone — a member the host removed, or one
   * from before members were persisted. Rendering a stale avatar would be a
   * guess; a blank cell is the truth. */
  creator: WorkspaceMember | null;
};

const COLUMNS = "grid-cols-[2.3fr_90px_110px_130px]";

const day = new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" });
const stamp = (iso: string) => (iso ? day.format(new Date(iso)) : "—");

/**
 * The workspace's documents (FR-020-06, the document half).
 *
 * Rows do not navigate. There is no editor to open until the block work
 * (FR-022), and a row that looks clickable and goes nowhere is worse than one
 * that never offered — so no anchor, no pointer cursor. `+ 새 문서` and the type
 * filter are rendered disabled for the same reason: nothing creates a document
 * yet, and every document is the same type until file blocks exist.
 *
 * Client-side only because of the search box. The rows themselves arrive as
 * props from the server component, so the list is in the HTML on first paint.
 */
export function DocumentList({ documents }: { documents: Array<DocumentRow> }) {
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return documents;
    return documents.filter((doc) => doc.name.toLowerCase().includes(needle));
  }, [documents, query]);

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
        {/* A disabled button swallows pointer events in most browsers, so a
            title on it never shows. The wrapper is what the pointer hits. */}
        <span title="문서 생성은 블록 편집기와 함께 들어옵니다">
          <button
            type="button"
            disabled
            className="rounded-md border border-sky-deep bg-sky px-4 py-1.5 text-[13px] font-bold text-ink disabled:opacity-40"
          >
            + 새 문서
          </button>
        </span>
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
                className={`grid ${COLUMNS} items-center border-b border-dashed border-ink/15 px-3.5 py-2.5 last:border-b-0`}
              >
                <span className="truncate text-[13.5px] font-semibold text-ink">{doc.name}</span>
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
