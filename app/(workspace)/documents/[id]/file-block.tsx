"use client";

import { useState } from "react";

import type { FileBlock } from "@/lib/blocks/types";
import { readableSize } from "@/lib/files/size";

/**
 * A file block (FR-022-13), and the fallback for every type FR-022-14 names no
 * viewer for — Word, PPT and Excel among them.
 *
 * **A download card, never a preview.** `/download` answers
 * `application/octet-stream` with an `attachment` disposition whatever the
 * stored type is (`lib/files/serving.ts`), which is what lets this block hold
 * any upload at all: nothing it points at can render or run in the browser.
 */
export function FileBlockView({
  block,
  onDelete,
}: {
  block: FileBlock;
  /** Removing a block is the document's operation, not this component's. */
  onDelete: (blockId: string) => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const name = block.fileName || "이름 없는 파일";

  return (
    <div className="group/file my-1 flex items-center gap-3 rounded-md border border-ink bg-paper-2 px-3 py-2">
      <span aria-hidden className="text-[18px] leading-none select-none">
        📄
      </span>

      <a
        href={`/api/files/${block.fileId}/download`}
        download={name}
        className="min-w-0 flex-1"
      >
        <span className="block truncate text-[13px] font-semibold text-ink" title={name}>
          {name}
        </span>
        <span className="block text-[11px] text-ink-faint">
          {readableSize(block.size)} · 내려받기
        </span>
      </a>

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
          className="shrink-0 rounded-md border border-ink bg-paper px-2 py-0.5 text-[11px] font-semibold text-ink-soft opacity-0 group-hover/file:opacity-100 group-focus-within/file:opacity-100"
        >
          삭제
        </button>
      )}
    </div>
  );
}
