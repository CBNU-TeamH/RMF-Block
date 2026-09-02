"use client";

import type { Document, EditOpInfo } from "@yorkie-js/sdk";
import { useCallback, useEffect, useRef, useState } from "react";

import { detectMarkdownShortcut, type MarkdownShortcut } from "@/lib/blocks/markdown-shortcuts";
import {
  detectSlashQuery,
  moveHighlight,
  slashMenuItems,
  type SlashAction,
} from "@/lib/blocks/slash-menu";
import { diffRange, shiftCaret } from "@/lib/blocks/text-surface";
import { BlockNotFoundError, editBlockText, type BlockArray } from "@/lib/blocks/operations";
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
 * What this block renders as beyond plain text — everything here is styling
 * only. The list bullet/number and the checklist's own checkbox render in
 * `editor.tsx` instead, as fixed siblings of this component rather than
 * something *inside* it that appears and disappears by variant — this
 * component's own returned root has to stay a bare `<textarea>` in every
 * variant, never conditionally wrapped in a `<div>`, or converting a block's
 * type changes this component's root element and React remounts it (a fresh
 * DOM node, focus lost — measured: converting to a list or checklist dropped
 * the cursor and made the block unclickable until reclicked). Every variant
 * still edits through the one `<textarea>`; `document-editing.md`'s "text ↔
 * quote... nothing but `type` changes" is what makes that true here too.
 */
export type BlockVariant =
  | { type: "text" }
  | { type: "heading"; level: HeadingLevel }
  | { type: "list"; style: "ordered" | "unordered" }
  | { type: "checklist"; checked: boolean }
  | { type: "quote" }
  | { type: "code" };

const TEXTAREA_CLASS_BY_VARIANT: Record<BlockVariant["type"], string> = {
  text: "text-[14px]",
  heading: "", // filled in per-level below
  list: "text-[14px]",
  checklist: "text-[14px]",
  quote: "text-[14px] border-l-2 border-ink-faint pl-3 italic text-ink-soft",
  code: "text-[13px] font-mono bg-paper-2 rounded-md px-2",
};

function textareaClass(variant: BlockVariant): string {
  if (variant.type === "heading") return HEADING_CLASS[variant.level];
  if (variant.type === "checklist" && variant.checked) {
    return `${TEXTAREA_CLASS_BY_VARIANT.checklist} text-ink-faint line-through`;
  }
  return TEXTAREA_CLASS_BY_VARIANT[variant.type];
}

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
  variant,
  docRef,
  registerRemoteHandler,
  registerTextarea,
  onMarkdownShortcut,
  onSplit,
  onMergeWithPrevious,
  onNavigateUp,
  onNavigateDown,
  onTextCommitted,
  onSlashSelect,
}: {
  blockId: BlockId;
  initialText: string;
  variant: BlockVariant;
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
   * owns `changeBlockType`, this component only ever edits text. Never
   * fires except from a plain-text block — see the `onInput` guard below. */
  onMarkdownShortcut: (blockId: BlockId, shortcut: MarkdownShortcut) => void;
  /** A `/` menu item was chosen. Like `onMarkdownShortcut`, the parent does the
   * document work — this component only ever edits text, and clearing the
   * query is the one edit it makes here. */
  onSlashSelect: (blockId: BlockId, action: SlashAction) => void;
  /** Enter, not mid-composition: reports where the caret was, so the parent
   * can trim this block to before it and seed a new one with the tail. */
  onSplit: (blockId: BlockId, cursorPosition: number) => void;
  /** Backspace with the caret collapsed at position 0. No positional info
   * needed — the merge point is the *previous* block's current length,
   * which only the parent (holding the ordered list) can resolve. */
  onMergeWithPrevious: (blockId: BlockId) => void;
  /** ArrowUp/ArrowDown with the caret on the block's first/last logical
   * line. `column` is the caret's offset within that line — the parent
   * clamps it against the target block's matching edge line. */
  onNavigateUp: (blockId: BlockId, column: number) => void;
  onNavigateDown: (blockId: BlockId, column: number) => void;
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
  /**
   * The `/` menu's session, as two pieces of state rather than one object:
   * the query is read off the textarea on every input, and the highlight is
   * moved by arrow keys. Only a plain text block opens one — the same guard
   * `onMarkdownShortcut` uses, and for the same reason: `/` inside a code
   * block is source, and re-triggering inside a heading is noise.
   */
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const slashItems = slashQuery === null ? [] : slashMenuItems(slashQuery);
  // "Open" means there is something to choose. With no matches the menu hides
  // and every key goes back to meaning what it usually means — Enter splits.
  const slashOpen = slashItems.length > 0;

  const closeSlash = () => {
    setSlashQuery(null);
    setHighlight(0);
  };

  /** Clears the query text this block is holding, then hands the choice up. */
  const chooseSlashItem = (index: number) => {
    const item = slashItems[index];
    if (!item) return;

    const el = textareaRef.current;
    if (el) {
      // The query is text like any other, so it goes out as an ordinary edit —
      // that keeps the diff baseline honest, the way the markdown path does.
      commitLocal("");
      el.value = "";
      autoGrow(el);
    }
    closeSlash();
    onSlashSelect(blockId, item.action);
  };

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
    try {
      doc.update((root: BlockDocumentRoot) => {
        editBlockText(root.blocks as BlockArray, blockId, from, to, value);
      });
    } catch (error) {
      // A peer removed this block mid-keystroke — the same race every
      // `doc.update` in `editor.tsx` already guards, and the one call site
      // that was missing it. There is nothing left to write into, and the
      // baseline deliberately stays where it is: this keystroke never
      // reached Yorkie, so advancing it would make the *next* diff describe
      // an edit against text that was never sent.
      if (error instanceof BlockNotFoundError) return;
      throw error;
    }
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
    <>
      <textarea
        ref={setTextareaRef}
      defaultValue={initialText}
      rows={1}
      onKeyDown={(event) => {
        // While the `/` menu is up it owns these four keys — Enter especially,
        // which must choose an item rather than split the block. Everything
        // else still reaches the textarea, so the query keeps being typed.
        if (slashOpen) {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlight((current) => moveHighlight(current, 1, slashItems.length));
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlight((current) => moveHighlight(current, -1, slashItems.length));
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            closeSlash();
            return;
          }
          if (event.key === "Enter" && !event.shiftKey) {
            // An Enter that is confirming an IME candidate belongs to the IME,
            // not to the menu — the same two-signal check the split path makes.
            if (composingRef.current || event.nativeEvent.isComposing) return;
            event.preventDefault();
            chooseSlashItem(highlight);
            return;
          }
        }

        if (event.key === "Enter" && !event.shiftKey) {
          // Shift+Enter is a literal newline within the block — normal
          // behavior, not intercepted. Both signals checked, not just one:
          // a composition-confirming Enter's `isComposing` is inconsistent
          // across browsers, and `composingRef` alone can lag a keydown
          // that also ends the composition.
          if (composingRef.current || event.nativeEvent.isComposing) return;

          if (variant.type === "code") {
            // Code is source text, not a sequence of blocks — Enter here is
            // a literal newline (`document-editing.md`: "inside code it is
            // a newline"), same as Shift+Enter everywhere else, UNLESS the
            // cursor is already on a blank line at the very end: that means
            // this is a *second* Enter with nothing typed in between, which
            // is how you leave a code block with no block-type menu to do
            // it from otherwise. Only fires at the true end, not on a blank
            // line in the middle of otherwise real code.
            const el = event.currentTarget;
            const pos = el.selectionStart ?? 0;
            const onTrailingBlankLine = pos === el.value.length && el.value.endsWith("\n");
            if (!onTrailingBlankLine) return;
          }

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
          return;
        }

        if (event.key === "ArrowUp") {
          const el = event.currentTarget;
          const pos = el.selectionStart ?? 0;
          // ponytail: logical \n boundaries only, not visual/wrapped lines —
          // arrow-up from a wrapped middle line of a long single-paragraph
          // block jumps a whole block instead of one visual line up. Real
          // fix needs layout measurement; blocks are short enough in
          // practice that this hasn't mattered yet.
          if (!el.value.slice(0, pos).includes("\n")) {
            event.preventDefault();
            onNavigateUp(blockId, pos);
          }
          return;
        }

        if (event.key === "ArrowDown") {
          const el = event.currentTarget;
          const pos = el.selectionStart ?? 0;
          if (!el.value.slice(pos).includes("\n")) {
            event.preventDefault();
            const lastNewline = el.value.slice(0, pos).lastIndexOf("\n");
            onNavigateDown(blockId, pos - (lastNewline + 1));
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

        // Only a plain-text block ever converts — re-checking an
        // already-converted block would let a code block's own literal
        // "# " or "- " (legitimate source text) trigger a conversion it
        // never asked for, and re-typing a marker into an existing heading
        // has the same problem at a smaller scale.
        // Same guard as the markdown check below, for the same reason: `/` in a
        // code block is source text, and a heading does not need converting
        // again. Recomputed from the text rather than tracked as a session, so
        // deleting back through the slash closes the menu on its own.
        const query = variant.type === "text" ? detectSlashQuery(el.value) : null;
        if (query !== slashQuery) {
          setSlashQuery(query);
          setHighlight(0);
        }

        const shortcut = variant.type === "text" ? detectMarkdownShortcut(el.value) : null;
        if (shortcut) {
          onMarkdownShortcut(blockId, shortcut);
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
        className={`min-w-0 flex-1 resize-none overflow-hidden bg-transparent px-1 py-0.5 text-ink outline-none ${textareaClass(variant)}`}
      />

      {/* Absolutely positioned against the block row, which is already
       * `relative`. That is what keeps this component's contract intact: the
       * textarea is still the first child and still a bare `<textarea>`, and an
       * out-of-flow sibling is not a flex item, so the row's layout does not
       * move when the menu opens (`BlockVariant`'s note on why a wrapper here
       * remounts the textarea and drops the caret). */}
      {slashOpen ? (
        <ul
          role="listbox"
          aria-label="블록 종류"
          className="absolute top-full left-6 z-20 mt-1 max-h-64 w-64 overflow-y-auto rounded-md border border-ink bg-paper py-1 shadow-lg"
        >
          {slashItems.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === highlight}
                // `mousedown`, not `click`: the textarea would blur first
                // otherwise, and the block would lose the caret the choice is
                // supposed to land in.
                onMouseDown={(event) => {
                  event.preventDefault();
                  chooseSlashItem(index);
                }}
                onMouseEnter={() => setHighlight(index)}
                className={`flex w-full flex-col items-start px-3 py-1.5 text-left ${
                  index === highlight ? "bg-sky-soft" : "bg-transparent"
                }`}
              >
                <span className="text-[13px] font-semibold text-ink">{item.label}</span>
                <span className="text-[11px] text-ink-faint">{item.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
