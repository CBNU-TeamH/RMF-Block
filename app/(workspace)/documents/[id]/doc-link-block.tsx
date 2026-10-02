"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { DocLinkBlock } from "@/lib/blocks/types";

import { FileIcon } from "../../ui";

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
    <div className="group/link -mx-1 flex items-center gap-2 rounded-control px-1 py-1 text-[16.5px] hover:bg-hover">
      <span className="shrink-0 text-ink-soft">
        <FileIcon size={17} />
      </span>

      {missing ? (
        <span className="min-w-0 flex-1 truncate text-ink-faint line-through">
          삭제된 문서입니다.
        </span>
      ) : (
        <Link
          href={`/documents/${block.documentId}`}
          className="min-w-0 truncate font-medium text-ink underline decoration-line-strong underline-offset-4"
        >
          {name ?? "여는 중…"}
        </Link>
      )}

      {confirmingDelete ? (
        <span className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onDelete(block.id)}
            className="h-6 rounded-control bg-danger px-2 text-xs font-semibold text-paper"
          >
            삭제
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(false)}
            className="h-6 rounded-control px-2 text-xs font-medium text-ink hover:bg-hover"
          >
            취소
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          className="ml-auto shrink-0 h-6 rounded-control px-2 text-xs font-medium text-ink-faint opacity-0 hover:bg-hover hover:text-danger group-hover/link:opacity-100 group-focus-within/link:opacity-100"
        >
          삭제
        </button>
      )}
    </div>
  );
}
