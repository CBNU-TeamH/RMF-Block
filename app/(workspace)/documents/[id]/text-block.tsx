"use client";

import type { Document, EditOpInfo } from "@yorkie-js/sdk";
import { useCallback, useEffect, useRef } from "react";

import { headingShortcut } from "@/lib/blocks/markdown-shortcuts";
import { diffRange, shiftCaret } from "@/lib/blocks/text-surface";
import { editBlockText, type BlockArray } from "@/lib/blocks/operations";
import type { BlockDocumentRoot } from "@/lib/blocks/document";
import type { BlockId, HeadingLevel } from "@/lib/blocks/types";

/** Font weight/size by level — the only visual difference a heading has from
 * plain text (`types.ts`: styling for every other type comes from `type`
 * alone too, nothing here is heading-specific machinery). */
const HEADING_CLASS: Record<HeadingLevel, string> = {
  1: "text-2xl font-bold",
  2: "text-xl font-bold",
  3: "text-lg font-semibold",
};

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
  headingLevel,
  docRef,
  registerRemoteHandler,
  registerTextarea,
  onMarkdownShortcut,
  onSplit,
  onMergeWithPrevious,
  onTextCommitted,
}: {
  blockId: BlockId;
  initialText: string;
  /** Set once this block's `type` is already `"heading"` — styling only.
   * `undefined` renders as plain text. */
  headingLevel?: HeadingLevel;
  docRef: React.RefObject<Document<BlockDocumentRoot> | null>;
  /** Returns an unsubscribe — the parent owns one Yorkie subscription for the
   * whole document and routes each block's edits here by id. */
  registerRemoteHandler: (blockId: BlockId, handler: (op: EditOpInfo) => void) => () => void;
  /** Same shape as `registerRemoteHandler`, one layer up — lets the parent
   * reach this block's live textarea by id, for focus after a split or
   * merge (a block that just mounted, or one that already existed and
   * isn't remounting, both need the parent to reach in imperatively). */
  registerTextarea: (blockId: BlockId, el: HTMLTextAreaElement | null) => void;
  /** Reports a markdown marker completing (`"# "` and friends) — the parent
   * owns `changeBlockType`, this component only ever edits text. */
  onMarkdownShortcut: (blockId: BlockId, level: HeadingLevel) => void;
  /** Enter, not mid-composition: reports where the caret was, so the parent
   * can trim this block to before it and seed a new one with the tail. */
  onSplit: (blockId: BlockId, cursorPosition: number) => void;
  /** Backspace with the caret collapsed at position 0. No positional info
   * needed — the merge point is the *previous* block's current length,
   * which only the parent (holding the ordered list) can resolve. */
  onMergeWithPrevious: (blockId: BlockId) => void;
  /** Called after every local text commit — not just here, and not tied to
   * this block's id, since the parent checks the *document's* trailing
   * block, not this one specifically. */
  onTextCommitted: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Stable across this block's re-renders (memoized on blockId/registerTextarea,
  // both fixed for the block's lifetime) — an inline arrow here would make
  // React re-invoke the ref callback (tearing down and re-adding the Map
  // entry) on every re-render, since a ref callback's *identity* deciding
  // whether it reruns, not an effect's dependency list.
  const setTextareaRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      textareaRef.current = el;
      registerTextarea(blockId, el);
    },
    [blockId, registerTextarea],
  );
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
      ref={setTextareaRef}
      defaultValue={initialText}
      rows={1}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          // Shift+Enter is a literal newline within the block — normal
          // behavior, not intercepted. Both signals checked, not just one:
          // a composition-confirming Enter's `isComposing` is inconsistent
          // across browsers, and `composingRef` alone can lag a keydown
          // that also ends the composition.
          if (composingRef.current || event.nativeEvent.isComposing) return;
          event.preventDefault();
          onSplit(blockId, event.currentTarget.selectionStart);
          return;
        }

        if (event.key === "Backspace") {
          const el = event.currentTarget;
          // Collapsed at the very start only — a real selection should
          // just delete normally, not merge blocks.
          if (el.selectionStart === 0 && el.selectionEnd === 0) {
            event.preventDefault();
            onMergeWithPrevious(blockId);
          }
        }
      }}
      onInput={(event) => {
        const el = event.currentTarget;
        autoGrow(el);
        // Composed while `compositionend` is pending; committed there as one
        // edit instead of one per IME candidate (measured: an uncomposed
        // binding sends one edit per candidate revision, not per character).
        if (composingRef.current) return;

        // Checked against the *whole* current value, not just what changed —
        // `headingShortcut` only ever matches when that whole value is
        // exactly a marker, so this never fires except right as one finishes.
        const level = headingShortcut(el.value);
        if (level !== null) {
          onMarkdownShortcut(blockId, level);
          // The parent clears this block's text as part of the conversion;
          // mirrored here so the *next* keystroke diffs against "", not
          // against a marker that no longer exists in Yorkie — the same
          // stale-baseline bug that produced "안안녕녕하세요" in milestone 2.
          el.value = "";
          lastSyncedRef.current = "";
          autoGrow(el);
          return;
        }

        commitLocal(el.value);
        onTextCommitted();
      }}
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={(event) => {
        composingRef.current = false;
        commitLocal(event.currentTarget.value);
        onTextCommitted();
        flushQueuedRemoteEdits();
      }}
      className={`w-full resize-none overflow-hidden bg-transparent px-1 py-0.5 text-ink outline-none ${
        headingLevel ? HEADING_CLASS[headingLevel] : "text-[14px]"
      }`}
    />
  );
}
