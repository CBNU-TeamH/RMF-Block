"use client";

import { useState } from "react";

import type { ImageBlock } from "@/lib/blocks/types";
import { readableSize } from "@/lib/files/size";

/**
 * An image block (FR-022-14's image leg).
 *
 * The `<img>` points at `/preview`, which answers `inline` only for a stored
 * type the upload route proved from the bytes — so what reaches this tag is an
 * image or nothing. Styling is a prototype, like the PDF block's: `docs/ui/`
 * has no artboard for a file block.
 */
export function ImageBlockView({
  block,
  onDelete,
}: {
  block: ImageBlock;
  /** Removing a block is the document's operation, not this component's. */
  onDelete: (blockId: string) => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Whether the bytes are gone — an id from another client, or a block copied
  // out of a workspace that had the file. `onError` rather than a `HEAD`: an
  // `<img>` reports its own failure, which a `<iframe>` does not.
  const [broken, setBroken] = useState(false);

  const name = block.fileName || "이름 없는 이미지";

  return (
    <div className="group/file my-1 rounded-md border border-ink bg-paper-2 p-2">
      {broken ? (
        <p className="px-1 py-4 text-center text-sm text-ink-faint">
          이미지를 찾을 수 없습니다 ({name}).
        </p>
      ) : (
        <a href={`/api/files/${block.fileId}/download`} download={name}>
          {/* Not `next/image`: that optimizer fetches through the Next server,
            * which would need this route allow-listed and would cache bytes a
            * guest may not be entitled to. A plain tag reads the same endpoint
            * every other file block does. `max-h` so one photo cannot push the
            * rest of the document off the screen. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/files/${block.fileId}/preview`}
            alt={name}
            onError={() => setBroken(true)}
            className="mx-auto block max-h-[420px] rounded-sm"
          />
        </a>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 px-1">
        <span className="truncate text-[12px] text-ink-soft" title={name}>
          {name} · {readableSize(block.size)}
        </span>

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
    </div>
  );
}
