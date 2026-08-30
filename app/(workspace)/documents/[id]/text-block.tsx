"use client";

import type { Document, EditOpInfo } from "@yorkie-js/sdk";
import { useEffect, useRef } from "react";

import { diffRange, shiftCaret } from "@/lib/blocks/text-surface";
import { editBlockText, type BlockArray } from "@/lib/blocks/operations";
import type { BlockDocumentRoot } from "@/lib/blocks/document";
import type { BlockId } from "@/lib/blocks/types";

/**
 * One text block's editing surface — `document-editing.md`'s "Editing
 * surface" decision, as code. An uncontrolled `<textarea>`, patched only on
 * the changed range, with remote edits held back while an IME composition is
 * in progress and flushed once it ends.
 *
 * Deliberately never re-reads `initialText` after mounting. A controlled
 * `value={text}` re-rendered from a remote edit is exactly the binding Step 0
 * measured corrupting text under concurrent editing — this component's own
 * state (the DOM node's `.value`) is the only source of truth once it exists.
 */
export function TextBlockView({
  blockId,
  initialText,
  docRef,
  registerRemoteHandler,
}: {
  blockId: BlockId;
  initialText: string;
  docRef: React.RefObject<Document<BlockDocumentRoot> | null>;
  /** Returns an unsubscribe — the parent owns one Yorkie subscription for the
   * whole document and routes each block's edits here by id. */
  registerRemoteHandler: (blockId: BlockId, handler: (op: EditOpInfo) => void) => () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);
  const pendingRemoteRef = useRef<Array<EditOpInfo>>([]);
  // "What I last told Yorkie the text was" — the diff baseline for the next
  // local keystroke. Has to advance on *every* path that touches the text,
  // remote patches included, or the next local edit reinserts whatever the
  // textarea shows as if it were new (measured: "안안녕녕하세요").
  const lastSyncedRef = useRef(initialText);

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const patchRange = (el: HTMLTextAreaElement, op: EditOpInfo) => {
    const { from, to, value } = op;
    const selStart = el.selectionStart ?? 0;
    const selEnd = el.selectionEnd ?? 0;

    el.value = el.value.slice(0, from) + value.content + el.value.slice(to);
    lastSyncedRef.current = el.value;

    const insertedLength = value.content.length;
    const newStart = shiftCaret(selStart, { from, to, insertedLength });
    const newEnd = shiftCaret(selEnd, { from, to, insertedLength });
    if (newStart !== null && newEnd !== null) {
      el.selectionStart = newStart;
      el.selectionEnd = newEnd;
    }
    // An edit overlapping the caret leaves the browser's own post-mutation
    // caret in place rather than guessing — see `shiftCaret`.

    autoGrow(el);
  };

  useEffect(() => {
    return registerRemoteHandler(blockId, (op) => {
      const el = textareaRef.current;
      if (!el) return;

      if (composingRef.current) {
        pendingRemoteRef.current.push(op);
        return;
      }
      patchRange(el, op);
    });
    // `registerRemoteHandler` is stable for the block's lifetime (see
    // editor.tsx); `blockId` never changes for a mounted instance either,
    // since the parent keys each `TextBlockView` by it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commitLocal = (newValue: string) => {
    const doc = docRef.current;
    const current = lastSyncedRef.current;
    if (!doc || current === newValue) return;

    const { from, to, value } = diffRange(current, newValue);
    doc.update((root: BlockDocumentRoot) => {
      editBlockText(root.blocks as BlockArray, blockId, from, to, value);
    });
    lastSyncedRef.current = newValue;
  };

  const flushQueuedRemoteEdits = () => {
    const el = textareaRef.current;
    if (!el) return;
    const queued = pendingRemoteRef.current;
    pendingRemoteRef.current = [];
    for (const op of queued) patchRange(el, op);
  };

  return (
    <textarea
      ref={textareaRef}
      defaultValue={initialText}
      rows={1}
      onInput={(event) => {
        autoGrow(event.currentTarget);
        // Composed while `compositionend` is pending; committed there as one
        // edit instead of one per IME candidate (measured: an uncomposed
        // binding sends one edit per candidate revision, not per character).
        if (composingRef.current) return;
        commitLocal(event.currentTarget.value);
      }}
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={(event) => {
        composingRef.current = false;
        commitLocal(event.currentTarget.value);
        flushQueuedRemoteEdits();
      }}
      className="w-full resize-none overflow-hidden rounded-md border border-transparent bg-transparent p-1.5 text-[14px] text-ink outline-none focus:border-ink/30"
    />
  );
}
