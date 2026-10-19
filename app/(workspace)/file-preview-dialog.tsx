"use client";

import { useEffect, useRef } from "react";

import { kindOf } from "@/lib/chat/attachments";

/** A stored image or PDF in a window over a dimmed page: the file lists'
 *  미리보기 (FR-050-03, FR-061-03) and a PDF block's 전체 화면 (FR-080-04). Why
 *  not a floating view: `docs/design/file-manager.md`. */

export type PreviewFile = { fileId: string; fileName: string; fileType: string };

export function FilePreviewDialog({ file, onClose }: { file: PreviewFile | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Only `showModal()` gives the backdrop, the focus trap and Esc, and it has no
  // declarative equivalent.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (file && !dialog.open) dialog.showModal();
    if (!file && dialog.open) dialog.close();
  }, [file]);

  const preview = file ? `/api/files/${file.fileId}/preview` : "";

  return (
    <dialog
      ref={dialogRef}
      aria-label={file ? `${file.fileName} 미리보기` : undefined}
      // Fires for both Esc and our own `close()`, so this is the single place
      // the open state comes back down.
      onClose={onClose}
      // A click on the backdrop targets the dialog itself; one on anything
      // inside targets that child instead.
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className="m-auto h-[85vh] w-[min(92vw,64rem)] overflow-hidden rounded-card bg-elev p-0 shadow-elev backdrop:bg-[rgba(10,14,20,0.6)]"
    >
      {/* Only mounted while open: an `<iframe>` or `<img>` inside a closed
          `<dialog>` still loads its source. */}
      {file ? (
        <div className="flex h-full flex-col">
          <div className="flex h-11 flex-none items-center gap-2 border-b border-line pr-2 pl-4">
            <span className="min-w-0 flex-1 truncate font-semibold text-ink">{file.fileName}</span>
            <a
              href={`/api/files/${file.fileId}/download`}
              className="flex h-7 items-center rounded-control px-2 text-[13px] font-medium text-ink-soft hover:bg-hover hover:text-ink"
            >
              내려받기
            </a>
            {/* Not decoration: once focus is inside a PDF viewer, Esc is its own. */}
            <button
              type="button"
              onClick={onClose}
              className="h-7 rounded-control px-2 text-[13px] font-medium text-ink-soft hover:bg-hover hover:text-ink"
            >
              닫기
            </button>
          </div>
          {kindOf(file.fileType) === "pdf" ? (
            <iframe src={preview} title={file.fileName} className="w-full flex-1 border-0" />
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center bg-paper-2 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- same reason as `image-block.tsx` */}
              <img src={preview} alt={file.fileName} className="max-h-full max-w-full object-contain" />
            </div>
          )}
        </div>
      ) : null}
    </dialog>
  );
}
