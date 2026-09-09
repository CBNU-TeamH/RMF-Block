"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { DocLinkBlock } from "@/lib/blocks/types";

/**
 * A link to another document (SRS §4.1 type 11).
 *
 * The block stores only an id, so the name is fetched. **A target that is gone
 * is a real state, not an error**: FR-023-04 deletes documents and nothing
 * rewrites the blocks pointing at them, so this renders an unavailable link the
 * same way a file block whose bytes are missing renders a missing file.
 */
export function DocLinkBlockView({
  block,
  onDelete,
}: {
  block: DocLinkBlock;
  /** Removing a block is the document's operation, not this component's. */
  onDelete: (blockId: string) => void;
}) {
  const [name, setName] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // The catalogue, not the document itself: this needs a name, and asking
    // Yorkie for one would mean attaching to a document nobody is reading.
    fetch(`/api/documents/${block.documentId}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((body) => {
        if (!cancelled) setName(body.document?.name ?? null);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });

    return () => {
      cancelled = true;
    };
  }, [block.documentId]);

  return (
    <div className="group/link my-1 flex items-center gap-2 rounded-md border border-ink bg-paper-2 px-3 py-2">
      <span aria-hidden className="text-[15px] leading-none select-none">
        🔗
      </span>

      {missing ? (
        <span className="min-w-0 flex-1 truncate text-[13px] text-ink-faint">
          삭제된 문서입니다.
        </span>
      ) : (
        <Link
          href={`/documents/${block.documentId}`}
          className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink underline decoration-ink-faint underline-offset-2"
        >
          {name ?? "여는 중…"}
        </Link>
      )}

      {confirmingDelete ? (
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onDelete(block.id)}
            className="rounded-md border border-ink bg-ink px-2 py-0.5 text-[11px] font-semibold text-paper"
          >
            삭제
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(false)}
            className="rounded-md border border-ink bg-paper px-2 py-0.5 text-[11px] font-semibold text-ink"
          >
            취소
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          className="shrink-0 rounded-md border border-ink bg-paper px-2 py-0.5 text-[11px] font-semibold text-ink-soft opacity-0 group-hover/link:opacity-100 group-focus-within/link:opacity-100"
        >
          삭제
        </button>
      )}
    </div>
  );
}
