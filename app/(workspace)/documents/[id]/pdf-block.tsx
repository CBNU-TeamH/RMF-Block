"use client";

import { useEffect, useRef, useState } from "react";

import type { PdfBlock } from "@/lib/blocks/types";

/**
 * A PDF block, and the in-app viewer it opens (FR-022-14's PDF leg, UC-080).
 *
 * **The browser renders the PDF, not a library.** Every browser
 * `docs/SRS-ko.md` §4.2 supports — Chrome/Edge 145+, Firefox 148+, Safari 26+ —
 * ships a PDF viewer with paging, zoom, search and print already, and reaching
 * it costs one `<iframe>`. Adding `pdfjs-dist` to reimplement those in a canvas
 * would be a multi-megabyte dependency and a worker asset, which is the
 * "unrequested abstraction" `AGENTS.md` §3.2 rules out.
 *
 * The source is `/api/files/:id/preview`, the one endpoint allowed to name a
 * real content type. Why that is safe for a PDF is argued where the rule lives,
 * in `lib/files/serving.ts`, not here.
 *
 * **Prototype styling.** `docs/ui/` has no artboard for a file block, so this
 * borrows the shell's vocabulary the way `chat-message.tsx` does — the
 * `ink`/`paper`/`sky` tokens and a 1px `border-ink` edge — rather than
 * inventing one. Meant to be replaced once there is a design.
 */

/** Restated from `chat-message.tsx` rather than shared: six lines, two callers,
 *  and no behaviour rides on the two agreeing. */
function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

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

  const dialogRef = useRef<HTMLDialogElement>(null);

  const preview = `/api/files/${block.fileId}/preview`;
  const download = `/api/files/${block.fileId}/download`;

  /**
   * A real `<dialog>` opened with `showModal()`, for the reasons `join-form.tsx`
   * already writes down: it is the only way to get the backdrop, the focus trap
   * and the inertness of everything behind it, none of which has a declarative
   * equivalent. Esc comes with it (FR-080-04) — the browser's own dismissal,
   * arriving here as `onClose` below, rather than a key handler of ours.
   *
   * One caveat worth knowing: most of this dialog is the browser's PDF viewer,
   * a document of its own. Once focus is inside it, Esc is that viewer's to
   * interpret, which is why the 닫기 button exists rather than being decoration.
   */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (expanded && !dialog.open) dialog.showModal();
    if (!expanded && dialog.open) dialog.close();
  }, [expanded]);

  /**
   * A block whose file this store has never seen: the id came from another
   * client (the document is writable by anything on the LAN — `document.ts`),
   * or the block was copied from a workspace that had it. The frame would
   * otherwise show the preview endpoint's JSON 404, which is worse than saying
   * so.
   *
   * `HEAD`, so the answer arrives without the bytes crossing the network — the
   * frame below fetches those itself. Checked once per mount: the case this
   * exists for never resolves on its own, so there is nothing to retry for.
   */
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
    <div className="my-1 overflow-hidden rounded-md border border-ink bg-paper-2">
      <div className="flex items-center gap-2 border-b border-ink px-3 py-2">
        <span aria-hidden className="text-base">
          📄
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-ink">{name}</span>
          <span className="font-mono text-[10px] tracking-wide text-ink-faint uppercase">
            PDF · {readableSize(block.size)}
          </span>
        </span>

        {!missing ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-md border border-ink bg-paper px-2 py-1 text-[11px] font-semibold text-ink hover:bg-sky-soft"
          >
            전체 화면
          </button>
        ) : null}
        <a
          href={download}
          className="rounded-md border border-ink bg-paper px-2 py-1 text-[11px] font-semibold text-ink hover:bg-sky-soft"
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
              className="rounded-md border border-ink bg-ink px-2 py-1 text-[11px] font-semibold text-paper"
            >
              삭제
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-md border border-ink bg-paper px-2 py-1 text-[11px] font-semibold text-ink"
            >
              취소
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            aria-label={`${name} 블록 삭제`}
            className="rounded-md border border-ink bg-paper px-2 py-1 text-[11px] font-semibold text-ink-soft hover:bg-paper-2"
          >
            삭제
          </button>
        )}
      </div>

      {missing ? (
        // UC-080's E3 shape: say it cannot be shown, and still offer the bytes.
        <p className="px-3 py-6 text-center text-[13px] text-ink-faint">
          이 파일을 찾을 수 없습니다. 다른 워크스페이스에서 온 블록일 수 있습니다.
        </p>
      ) : (
        <iframe src={preview} title={name} className="block h-[460px] w-full border-0 bg-paper" />
      )}

      <dialog
        ref={dialogRef}
        aria-label={`${name} 미리보기`}
        // Fires for both Esc and our own `close()`, so this is the single place
        // the open state comes back down.
        onClose={() => setExpanded(false)}
        // A click on the backdrop targets the dialog itself; one on anything
        // inside targets that child instead.
        onClick={(event) => {
          if (event.target === dialogRef.current) setExpanded(false);
        }}
        className="m-auto h-[85vh] w-[min(92vw,64rem)] overflow-hidden rounded-md border border-ink bg-paper p-0 backdrop:bg-ink/70"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 border-b border-ink px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
              {name}
            </span>
            <a
              href={download}
              className="rounded-md border border-ink bg-paper-2 px-2 py-1 text-[11px] font-semibold text-ink hover:bg-sky-soft"
            >
              내려받기
            </a>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-md border border-ink bg-paper-2 px-2 py-1 text-[11px] font-semibold text-ink hover:bg-sky-soft"
            >
              닫기
            </button>
          </div>
          {/* Only mounted while open: an `<iframe>` inside a closed `<dialog>`
           * still loads its source, so every PDF block on the page would fetch
           * its file twice. */}
          {expanded ? (
            <iframe src={preview} title={name} className="w-full flex-1 border-0" />
          ) : null}
        </div>
      </dialog>
    </div>
  );
}
