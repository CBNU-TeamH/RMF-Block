import { useState } from "react";

import { createFile, createImage, createPdf } from "@/lib/blocks/create";
import { toStoredBlock, type BlockDocumentRoot, type StoredBlock } from "@/lib/blocks/document";
import { appendBlock, insertBlockAfter, type BlockArray } from "@/lib/blocks/operations";
import type { Block, BlockId } from "@/lib/blocks/types";
import type { StoredFile } from "@/lib/files/types";

/** What the server said this file is, turned into the block that shows it.
 *  **The server's `type` decides, not the file's name or the request's claim**
 *  — it is the only one of the three that was checked against the bytes
 *  (`docs/design/api.md` §1). An unrecognised type is an octet-stream, which is
 *  a file block: a download card, never a preview. */
function blockForStored(stored: StoredFile): Block {
  const file = { fileId: stored.id, fileName: stored.name, size: stored.size };

  if (stored.type === "application/pdf") return createPdf(file);
  if (stored.type.startsWith("image/")) return createImage(file);

  return createFile({ ...file, fileType: stored.type });
}

/** Putting files into a document (FR-022-13, FR-022-14). `liveBlockOf` is injected
 *  rather than reimplemented — reading the live array has a rule that should have
 *  one implementation. */
export function useFileUpload({
  documentId,
  applyEdit,
  liveBlockOf,
  ensureTrailingEmptyBlock,
}: {
  documentId: string;
  applyEdit: (mutate: (root: BlockDocumentRoot, blocks: BlockArray) => void) => boolean;
  liveBlockOf: (root: BlockDocumentRoot, blockId: BlockId) => StoredBlock | null;
  /** Named plainly rather than hidden behind an `onDone` — a file at the very end
   *  would otherwise leave nowhere to click to start the next paragraph. */
  ensureTrailingEmptyBlock: () => void;
}) {
  // About the *request*, not the document — a file block exists only once its
  // bytes are stored, so nothing here reaches Yorkie. A count, not a flag: with
  // a flag the first of two concurrent drops to finish clears the indicator.
  const [uploadsInFlight, setUploadsInFlight] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploading = uploadsInFlight > 0;

  /** **The upload finishes before the block exists** — a placeholder would show
   *  peers a block pointing at a `fileId` the server has not issued, and a failed
   *  upload would leave one for good. Several files upload in order, each
   *  anchored after the last, so they land in the order they were dropped. */
  const uploadFiles = async (files: Array<File>, afterId: BlockId | null) => {
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
        const block = toStoredBlock(blockForStored(stored));

        const placed = applyEdit((root, array) => {
          // A peer can delete the anchor block mid-upload; appending still lands
          // the file in the document.
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

  return { uploading, uploadError, uploadFiles };
}
