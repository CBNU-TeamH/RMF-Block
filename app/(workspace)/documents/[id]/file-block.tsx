"use client";

import { useState } from "react";

import type { FileBlock } from "@/lib/blocks/types";
import { readableSize } from "@/lib/files/size";

import { FileIcon } from "../../ui";

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
    <div className="group/file my-1 flex items-center gap-3 rounded-control bg-paper-2 px-2.5 py-2">
      <span aria-hidden className="flex size-[34px] shrink-0 items-center justify-center rounded-control bg-paper text-ink-soft">
        <FileIcon size={17} />
      </span>

      <a
        href={`/api/files/${block.fileId}/download`}
        download={name}
        className="min-w-0 flex-1"
      >
        <span className="block truncate font-medium text-ink" title={name}>
          {name}
        </span>
        <span className="block text-[12.5px] text-ink-faint">
          {readableSize(block.size)} · 내려받기
        </span>
      </a>

      {confirmingDelete ? (
        <span className="flex shrink-0 items-center gap-1">
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
          className="shrink-0 h-6 rounded-control px-2 text-xs font-medium text-ink-faint opacity-0 hover:bg-hover hover:text-danger group-hover/file:opacity-100 group-focus-within/file:opacity-100"
        >
          삭제
        </button>
      )}
    </div>
  );
}
