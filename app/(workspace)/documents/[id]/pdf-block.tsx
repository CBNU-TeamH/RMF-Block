"use client";

import { useEffect, useState } from "react";

import type { PdfBlock } from "@/lib/blocks/types";
import { readableSize } from "@/lib/files/size";

import { FilePreviewDialog } from "../../file-preview-dialog";

/** A PDF block and the in-app viewer it opens (FR-022-14's PDF leg, UC-080).
 *  **The browser renders it, not a library** — every browser `docs/SRS-ko.md`
 *  §4.2 supports ships a viewer with paging, zoom, search and print, and one
 *  `<iframe>` reaches it. Styling is a prototype: `docs/ui/` has no artboard for
 *  a file block, so this borrows the shell's tokens. */

export function PdfBlockView({
  block,
  onDelete,
}: {
  block: PdfBlock;
  /** Removing a block is the document's operation, not this component's — it
   *  runs inside the editor's `doc.update()` like every other one. */
  onDelete: (blockId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Whether this file is one the store has never heard of. Starts false, so a
  // block draws its frame immediately and only falls back if the check says to.
  const [missing, setMissing] = useState(false);

  const preview = `/api/files/${block.fileId}/preview`;
  const download = `/api/files/${block.fileId}/download`;

  /** A block whose file this store has never seen, which would otherwise render
   *  the preview endpoint's JSON 404 in the frame. `HEAD`, so no bytes cross,
   *  and once per mount — this case never resolves on its own. */
  useEffect(() => {
    let cancelled = false;

    fetch(preview, { method: "HEAD" })
      .then((response) => {
        if (!cancelled) setMissing(!response.ok);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });

    return () => {
      cancelled = true;
    };
  }, [preview]);

  const name = block.fileName || "이름 없는 PDF";

  return (
    <div className="my-1.5 overflow-hidden rounded-card bg-paper-2">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span aria-hidden className="rounded bg-hover px-1.5 py-0.5 text-[11px] font-bold text-danger">
          PDF
        </span>
        <span className="min-w-0 flex-1 truncate font-medium text-ink">{name}</span>
        <span className="text-[12.5px] text-ink-faint">{readableSize(block.size)}</span>

        {!missing ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="h-7 rounded-control px-2 text-[13px] font-medium text-ink-soft hover:bg-hover hover:text-ink"
          >
            전체 화면
          </button>
        ) : null}
        <a
          href={download}
          className="flex items-center h-7 rounded-control px-2 text-[13px] font-medium text-ink-soft hover:bg-hover hover:text-ink"
        >
          내려받기
        </a>

        {/* NFR-SAF-002 asks for a re-confirmation before a delete. Inline
         * rather than `window.confirm`, which blocks the whole tab — including
         * the Yorkie client's own work — until it is answered. */}
        {confirmingDelete ? (
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onDelete(block.id)}
              className="h-7 rounded-control bg-danger px-2 text-[13px] font-semibold text-paper"
            >
              삭제
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="h-7 rounded-control px-2 text-[13px] font-medium text-ink hover:bg-hover"
            >
              취소
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            aria-label={`${name} 블록 삭제`}
            className="h-7 rounded-control px-2 text-[13px] font-medium text-ink-faint hover:bg-hover hover:text-danger"
          >
            삭제
          </button>
        )}
      </div>

      {missing ? (
        // UC-080's E3 shape: say it cannot be shown, and still offer the bytes.
        <p className="bg-paper px-3 py-8 text-center text-[13px] text-ink-faint">
          이 파일을 찾을 수 없습니다. 다른 워크스페이스에서 온 블록일 수 있습니다.
        </p>
      ) : (
        <iframe src={preview} title={name} className="block h-[460px] w-full border-0 bg-paper" />
      )}

      <FilePreviewDialog
        file={expanded ? { fileId: block.fileId, fileName: name, fileType: "application/pdf" } : null}
        onClose={() => setExpanded(false)}
      />
    </div>
  );
}
