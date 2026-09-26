"use client";

import { useState } from "react";

import type { DividerBlock } from "@/lib/blocks/types";

/**
 * 구분선 블록 (`docs/SRS-ko.md` §4.1) — the only block with no content of its
 * own, and until the `/` menu existed the only one with no way into a document
 * at all: no markdown marker, no upload, no menu.
 *
 * Having nothing to edit is what makes it awkward rather than trivial. There is
 * no caret to press Backspace in, so removing it needs its own affordance —
 * the same shape the PDF block uses, revealed on hover of the row (`group` is
 * on the row in `editor.tsx`) and asking once before it acts (NFR-SAF-002).
 */
export function DividerBlockView({
  block,
  onDelete,
}: {
  block: DividerBlock;
  onDelete: (blockId: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex items-center gap-2 py-3">
      {/* `<hr>` rather than a styled div: it is a thematic break, which is
       * exactly what this block means, and it comes with the role for free. */}
      <hr className="min-w-0 flex-1 border-0 border-t border-line" />

      {confirming ? (
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onDelete(block.id)}
            className="h-6 rounded-control bg-danger px-2 text-xs font-semibold text-paper"
          >
            삭제
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="h-6 rounded-control px-2 text-xs font-medium text-ink hover:bg-hover"
          >
            취소
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label="구분선 삭제"
          className="h-6 rounded-control px-2 text-xs font-medium text-ink-faint opacity-0 hover:bg-hover hover:text-danger group-hover:opacity-100 group-focus-within:opacity-100"
        >
          삭제
        </button>
      )}
    </div>
  );
}
