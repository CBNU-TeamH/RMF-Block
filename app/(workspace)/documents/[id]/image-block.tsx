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
    <div className="group/file my-1.5 flex flex-col gap-1.5">
      {broken ? (
        <p className="flex aspect-[16/9] items-center justify-center rounded-control bg-paper-2 px-3 text-center text-[13px] text-ink-faint">
          이미지를 찾을 수 없습니다 ({name}).
        </p>
      ) : (
        <a href={`/api/files/${block.fileId}/download`} download={name}>
          {/* Not `next/image`: that optimizer fetches through the Next server,
            * which would need this route allow-listed and would cache bytes a
            * guest may not be entitled to. A plain tag reads the same endpoint
            * every other file block does. `max-h` so one photo cannot push the
            * rest of the document off the screen, and left-aligned like every
            * other block's content — centring left a small image adrift in a
            * full-width box. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/files/${block.fileId}/preview`}
            alt={name}
            onError={() => setBroken(true)}
            className="block max-h-[420px] rounded-control"
          />
        </a>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] text-ink-faint" title={name}>
          {name} · {readableSize(block.size)}
        </span>

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
    </div>
  );
}
