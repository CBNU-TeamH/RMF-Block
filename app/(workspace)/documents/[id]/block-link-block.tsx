"use client";

import { useState } from "react";

import type { BlockLinkBlock } from "@/lib/blocks/types";

import { useFocusFollow } from "../../focus-follow-provider";
import { FileIcon } from "../../ui";
import { useDocumentName } from "./use-document-name";

/**
 * A link to one block in a document (SRS §4.1 type 12), made by pasting a
 * block address (링크 복사) into an empty block.
 *
 * Like `doc-link-block.tsx` it stores ids only, so the document's name is
 * fetched and **a target that is gone is a state, not an error**. A deleted
 * block cannot be told from here — that would mean attaching to the target
 * document — so following one lands on its document, as a chat link does.
 */
export function BlockLinkBlockView({
  block,
  onDelete,
}: {
  block: BlockLinkBlock;
  /** Removing a block is the document's operation, not this component's. */
  onDelete: (blockId: string) => void;
}) {
  const { goToBlock } = useFocusFollow();
  const { name, missing, failed, retry } = useDocumentName(block.documentId);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div className="group/link -mx-1 flex items-center gap-2 rounded-control px-1 py-1 text-[16.5px] hover:bg-hover">
      <span className="shrink-0 text-ink-soft">
        <FileIcon size={17} />
      </span>

      {missing ? (
        <span className="min-w-0 flex-1 truncate text-ink-faint line-through">
          삭제된 문서의 블록입니다.
        </span>
      ) : (
        <button
          type="button"
          onClick={() => goToBlock(block.documentId, block.blockId)}
          className="min-w-0 truncate text-left font-medium text-ink underline decoration-line-strong underline-offset-4"
        >
          {name ? `${name} › 블록` : failed ? "블록으로 이동" : "여는 중…"}
        </button>
      )}

      {failed && (
        <button
          type="button"
          onClick={retry}
          className="shrink-0 h-6 rounded-control px-2 text-xs font-medium text-ink-soft hover:bg-hover"
        >
          이름을 불러오지 못했습니다 · 다시 시도
        </button>
      )}

      {confirmingDelete ? (
        <span className="ml-auto flex shrink-0 items-center gap-1">
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
          className="ml-auto shrink-0 h-6 rounded-control px-2 text-xs font-medium text-ink-faint opacity-0 hover:bg-hover hover:text-danger group-hover/link:opacity-100 group-focus-within/link:opacity-100"
        >
          삭제
        </button>
      )}
    </div>
  );
}
