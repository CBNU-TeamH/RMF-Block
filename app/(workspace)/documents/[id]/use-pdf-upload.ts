import { useState } from "react";

import { createPdf } from "@/lib/blocks/create";
import { toStoredBlock, type BlockDocumentRoot, type StoredBlock } from "@/lib/blocks/document";
import { appendBlock, insertBlockAfter, type BlockArray } from "@/lib/blocks/operations";
import type { BlockId } from "@/lib/blocks/types";

/** Putting PDFs into a document (FR-022-13, FR-022-14). `liveBlockOf` is injected
 *  rather than reimplemented — reading the live array has a rule that should have
 *  one implementation. */
export function usePdfUpload({
  documentId,
  applyEdit,
  liveBlockOf,
  ensureTrailingEmptyBlock,
}: {
  documentId: string;
  applyEdit: (mutate: (root: BlockDocumentRoot, blocks: BlockArray) => void) => boolean;
  liveBlockOf: (root: BlockDocumentRoot, blockId: BlockId) => StoredBlock | null;
  /** Named plainly rather than hidden behind an `onDone` — a PDF at the very end
   *  would otherwise leave nowhere to click to start the next paragraph. */
  ensureTrailingEmptyBlock: () => void;
}) {
  // About the *request*, not the document — a PDF block exists only once its
  // bytes are stored, so nothing here reaches Yorkie. A count, not a flag: with
  // a flag the first of two concurrent drops to finish clears the indicator.
  const [uploadsInFlight, setUploadsInFlight] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploading = uploadsInFlight > 0;

  /** **The upload finishes before the block exists** — a placeholder would show
   *  peers a block pointing at a `fileId` the server has not issued, and a failed
   *  upload would leave one for good. Several files upload in order, each
   *  anchored after the last, so they land in the order they were dropped. */
  const uploadPdfs = async (files: Array<File>, afterId: BlockId | null) => {
    setUploadError(null);
    setUploadsInFlight((n) => n + 1);

    let anchor = afterId;

    try {
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);

        const response = await fetch(`/api/documents/${documentId}/files`, {
          method: "POST",
          body: form,
        });
        if (!response.ok) {
          // The endpoint's own Korean refusals are the useful part; a body that
          // is not the JSON we expect falls back.
          const body = await response.json().catch(() => null);
          throw new Error(body?.error ?? "파일을 올리지 못했습니다.");
        }

        const stored = await response.json();
        const block = toStoredBlock(
          createPdf({ fileId: stored.id, fileName: stored.name, size: stored.size }),
        );

        const placed = applyEdit((root, array) => {
          // A peer can delete the anchor block mid-upload; appending still lands
          // the PDF in the document.
          if (anchor !== null && !liveBlockOf(root, anchor)) anchor = null;

          if (anchor === null) appendBlock(array, block);
          else insertBlockAfter(array, anchor, block);
        });
        // Document closed mid-upload: the bytes are orphaned, which is UC-050's
        // file manager to deal with.
        if (!placed) return;

        anchor = block.id;
      }

      ensureTrailingEmptyBlock();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "파일을 올리지 못했습니다.");
    } finally {
      setUploadsInFlight((n) => n - 1);
    }
  };

  return { uploading, uploadError, uploadPdfs };
}
