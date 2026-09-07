"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createDivider, createText } from "@/lib/blocks/create";
import { BLOCK_KINDS, continuationBlock, isTextBearing } from "@/lib/blocks/registry";
import type { SlashAction } from "@/lib/blocks/slash-menu";
import { readBlocks, toStoredBlock, type BlockDocumentRoot, type StoredBlock } from "@/lib/blocks/document";
import type { MarkdownShortcut } from "@/lib/blocks/markdown-shortcuts";
import {
  appendBlock,
  BlockNotFoundError,
  changeBlockType,
  editBlockText,
  insertBlockAfter,
  moveBlockAfter,
  removeBlock,
  type BlockArray,
} from "@/lib/blocks/operations";
import { orderedListNumbers } from "@/lib/blocks/list-numbering";
import {
  dropDestination,
  dropsBeforeTarget,
  idAfterInOrder,
  idBeforeInOrder,
} from "@/lib/blocks/reorder";
import type { TextPatch } from "@/lib/blocks/text-surface";
import type { Block, BlockId, BlockType } from "@/lib/blocks/types";

import { useFocusFollow } from "../../focus-follow-provider";
import { useWorkspacePresence } from "../../presence-provider";
import { DividerBlockView } from "./divider-block";
import { PdfBlockView } from "./pdf-block";
import { TextBlockView, type BlockVariant } from "./text-block";
import { useBlockDocument } from "./use-block-document";
import { useFocusPresence } from "./use-focus-presence";
import { usePdfUpload } from "./use-pdf-upload";

/** Exhaustive on purpose — the `never` below makes a seventh text-bearing type a
 *  compile error rather than a block that silently renders as plain text. */
/** Typed and stored, but nothing can draw it yet. Shared so the wording is
 *  one string rather than one per surface. */
function UnsupportedBlock({ type }: { type: BlockType }) {
  return (
    <p className="px-1 py-0.5 text-sm text-ink-faint">
      아직 편집할 수 없는 블록입니다 ({type}).
    </p>
  );
}

function variantOf(block: Extract<Block, { text: string }>): BlockVariant {
  switch (block.type) {
    case "text":
      return { type: "text" };
    case "heading":
      return { type: "heading", level: block.level };
    case "list":
      return { type: "list", style: block.style };
    case "checklist":
      return { type: "checklist", checked: block.checked };
    case "quote":
      return { type: "quote" };
    case "code":
      return { type: "code" };
    default: {
      const unhandled: never = block;
      return unhandled;
    }
  }
}

/** One document's blocks and every edit made to them (FR-022-01~04, FR-022-09).
 *  Attaching and subscribing are `useBlockDocument`'s, following a presenter is
 *  `useFocusPresence`'s. The rules this holds to: `docs/design/document-editing.md`. */
export function DocumentEditor({ documentId }: { documentId: string }) {
  const { client, members, isPresenting, setPresenting } = useWorkspacePresence();
  const { followingId } = useFocusFollow();
  const { blocks, setBlocks, failed, docRef, registerRemoteHandler, patchBlockText } =
    useBlockDocument(client, documentId);
  // Opacity feedback only. Cleared on `dragend` as well as on drop — a drag
  // cancelled outside any block never fires `onDrop`.
  const [draggedId, setDraggedId] = useState<BlockId | null>(null);
  // Where the insertion line is drawn. Feedback shown *while* dragging, so it
  // need only be approximately where the block lands.
  const [dropIndicator, setDropIndicator] = useState<{
    targetId: BlockId;
    before: boolean;
  } | null>(null);

  // The scroll container from the render below (`data-focus-scroll`) — read
  // by both the presenter effect (this browser's own scroll → published
  // anchor) and the follower effect (a followed anchor → `scrollTo`).
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  // The footer's hidden file input, so the `/` menu's PDF item can open the
  // same picker the button does rather than growing a second one…
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  // …and where the block should land when it does. The picker is a native
  // dialog with its own lifetime, so the anchor cannot be an argument — it has
  // to wait somewhere until `change` fires, or be forgotten if it never does.
  const pdfAnchorRef = useRef<BlockId | null>(null);
  // Reaches a block's live textarea by id, to focus it after a split or merge.
  // `useCallback` is load-bearing: `text-block.tsx` memoizes on this reference,
  // so an inline arrow would re-add the Map entry every render.
  const elementsRef = useRef(new Map<BlockId, HTMLTextAreaElement>());
  const registerTextarea = useCallback((blockId: BlockId, el: HTMLTextAreaElement | null) => {
    if (el) elementsRef.current.set(blockId, el);
    else elementsRef.current.delete(blockId);
  }, []);

  // A ref, not state: the `setBlocks` that always accompanies a focus request
  // is what re-renders, and the effect below rides that same commit.
  const pendingFocusRef = useRef<{ blockId: BlockId; caret: number } | null>(null);
  const focusBlock = (blockId: BlockId, caret: number) => {
    pendingFocusRef.current = { blockId, caret };
  };

  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending) return;

    const el = elementsRef.current.get(pending.blockId);
    // Refs attach during commit, so a block that mounted this render is here;
    // if not, it is gone. Cleared either way, or a stale request would yank the
    // caret on the next unrelated `setBlocks`.
    pendingFocusRef.current = null;
    if (!el) return;
    el.focus();
    el.setSelectionRange(pending.caret, pending.caret);
  }, [blocks]);


  // Whether the editor has finished loading, as a value that changes once
  // rather than on every recompute — see the presenter effect's own note.
  const blocksLoaded = blocks !== null;

  // Order is the one thing `blocks` state is reliable for. Derived once, where
  // five places used to rebuild the same array.
  const order = useMemo(() => blocks?.map((block) => block.id) ?? [], [blocks]);

  useFocusPresence({
    documentId,
    containerRef: scrollContainerRef,
    blocksLoaded,
    blocks,
    members,
    followingId,
    isPresenting,
    setPresenting,
  });

  /** Read live, never from `blocks` state, and by iteration rather than `.find`
   *  — why both: `docs/design/document-editing.md`. */
  function liveBlockOf(root: BlockDocumentRoot, blockId: BlockId): StoredBlock | null {
    for (const stored of root.blocks) {
      if (stored?.id === blockId) return stored;
    }
    return null;
  }

  function liveTextOf(root: BlockDocumentRoot, blockId: BlockId): string {
    return liveBlockOf(root, blockId)?.content?.text?.toString() ?? "";
  }

  /** The one mutation path (`docs/design/document-editing.md`). `false` means the
   *  edit did not land, which is never an error to report. */
  const applyEdit = (
    mutate: (root: BlockDocumentRoot, blocks: BlockArray) => void,
  ): boolean => {
    const doc = docRef.current;
    if (!doc) return false;

    try {
      doc.update((root: BlockDocumentRoot) => mutate(root, root.blocks as BlockArray));
    } catch (error) {
      if (error instanceof BlockNotFoundError) return false;
      throw error;
    }

    setBlocks(readBlocks(doc.getRoot().blocks));
    return true;
  };

  /** Keeps one empty text block at the end (`docs/design/document-editing.md`). */
  const ensureTrailingEmptyBlock = (): BlockId | null => {
    const doc = docRef.current;
    if (!doc) return null;

    const root = doc.getRoot();
    const last = root.blocks[root.blocks.length - 1];
    const lastIsEmptyText = last?.type === "text" && (last.content?.text?.toString() ?? "") === "";
    if (lastIsEmptyText) return last.id;

    // Returns the block it guarantees — the one that was already there, or the
    // one it just made. Callers that only want the invariant can ignore it;
    // `focusEndOfDocument` needs to know where to put the caret.
    const block = toStoredBlock(createText());
    return applyEdit((_root, blocks) => appendBlock(blocks, block)) ? block.id : null;
  };

  /** A click on the empty space below lands the caret at the end — making a
   *  trailing block first if the document ends in one that cannot hold it. */
  const focusEndOfDocument = () => {
    const last = blocks?.[blocks.length - 1];

    if (last && isTextBearing(last)) {
      const el = elementsRef.current.get(last.id);
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
        return;
      }
    }

    // The new block does not exist in the DOM yet, so this goes through the
    // pending-focus request the split/merge handlers use: the `setBlocks`
    // inside `applyEdit` is what gives the effect a commit to run on.
    const blockId = ensureTrailingEmptyBlock();
    if (blockId) focusBlock(blockId, 0);
  };

  const { uploading, uploadError, uploadPdfs } = usePdfUpload({
    documentId,
    applyEdit,
    liveBlockOf,
    ensureTrailingEmptyBlock,
  });

  /** Clear the marker and convert in one update — `changeBlockType` keeps the id
   *  and the live text, so a peer typing in it survives. */  const handleMarkdownShortcut = (blockId: BlockId, shortcut: MarkdownShortcut) => {
    applyEdit((root, blocks) => {
      const current = liveTextOf(root, blockId);
      editBlockText(blocks, blockId, 0, current.length, "");
      changeBlockType(blocks, blockId, shortcut);
    });
  };

  /** Reads the live `checked` inside the same update — the primitive-field race
   *  stands, but the flip starts from what is actually there. */
  const handleToggleChecklist = (blockId: BlockId) => {
    applyEdit((root, blocks) => {
      const checked = liveBlockOf(root, blockId)?.content?.checked === true;
      changeBlockType(blocks, blockId, { type: "checklist", checked: !checked });
    });
  };

  /** A `/` menu choice (UC-022 기본 흐름 1). `text-block.tsx` has already cleared
   *  the query, so the block is empty and ready to become what was picked. */
  const handleSlashSelect = (blockId: BlockId, action: SlashAction) => {
    if (action.kind === "convert") {
      // The block keeps its id and its `yorkie.Text`, so a peer typing into it
      // through the conversion keeps their characters — `changeBlockType`'s own
      // contract, the same one the markdown shortcuts rely on.
      applyEdit((_root, blocks) => changeBlockType(blocks, blockId, action.fields));
      return;
    }

    if (action.kind === "divider") {
      // Above this block, not replacing it: the divider has no caret, and
      // leaving the person in the block they were already typing in means the
      // line they wanted under the rule is ready for them.
      const divider = toStoredBlock(createDivider());
      applyEdit((_root, blocks) =>
        insertBlockAfter(blocks, idBeforeInOrder(order, blockId), divider),
      );
      return;
    }

    pdfAnchorRef.current = blockId;
    pdfInputRef.current?.click();
  };

  /** Enter (FR-022-01): trim at the caret, insert the tail after. The new block
   *  continues a list/checklist/quote; Enter on an empty one of those exits to
   *  plain text instead of splitting. */  const handleSplit = (blockId: BlockId, cursorPosition: number) => {
    if (!blocks) return;

    const original = blocks.find((block) => block.id === blockId);
    let newBlockId: BlockId | null = null;
    // What the document did to *this* block's text, so the same thing can be
    // done to its textarea afterwards — see `trimmed` below.
    let trimmed: TextPatch | null = null;

    const applied = applyEdit((root, array) => {
      const liveText = liveTextOf(root, blockId);

      if (
        liveText.length === 0 &&
        (original?.type === "list" || original?.type === "checklist" || original?.type === "quote")
      ) {
        changeBlockType(array, blockId, { type: "text" });
        return;
      }

      const tail = liveText.slice(cursorPosition);
      const newBlock = toStoredBlock(continuationBlock(original));

      editBlockText(array, blockId, cursorPosition, liveText.length, "");
      insertBlockAfter(array, blockId, newBlock);
      if (tail) editBlockText(array, newBlock.id, 0, 0, tail);
      newBlockId = newBlock.id;
      trimmed = { from: cursorPosition, to: liveText.length, value: { content: "" } };
    });
    if (!applied) return;

    // The textarea is uncontrolled and read `initialText` once, so without this
    // the tail shows in both blocks and the next keystroke diffs against a string
    // the document no longer has (#59). The new block mounts from the document.
    if (trimmed) patchBlockText(blockId, trimmed);

    focusBlock(newBlockId ?? blockId, 0);
  };

  /** Backspace at offset 0 (FR-022-03): append to the previous block, remove this
   *  one. Order from state, text read live. */  const handleMergeWithPrevious = (blockId: BlockId) => {
    if (!blocks) return;

    const previousId = idBeforeInOrder(order, blockId);
    if (previousId === null) return;

    // A previous block with no text to append into — a divider, or a file or
    // link block from another client — would make `editBlockText` throw a plain
    // `Error` this handler does not catch. Treated as "no previous block".
    const previousBlock = blocks.find((block) => block.id === previousId);
    if (!previousBlock || !isTextBearing(previousBlock)) return;

    let mergeCaret = 0;
    // What the previous block's text gained, to be mirrored into its textarea.
    let appended: TextPatch | null = null;

    const applied = applyEdit((root, array) => {
      const previousText = liveTextOf(root, previousId);
      const thisText = liveTextOf(root, blockId);
      mergeCaret = previousText.length;

      editBlockText(array, previousId, previousText.length, previousText.length, thisText);
      removeBlock(array, blockId);
      appended = {
        from: mergeCaret,
        to: mergeCaret,
        value: { content: thisText },
      };
    });
    if (!applied) return;

    // The previous block keeps its id, so its textarea stays mounted with the
    // pre-merge value (#59). Patched before the caret moves, so the caret lands
    // after text that is on screen.
    if (appended) patchBlockText(previousId, appended);

    focusBlock(previousId, mergeCaret);
  };

  /** ArrowUp/ArrowDown across blocks. Focuses directly, not through `focusBlock`
   *  — that request is only consumed when `setBlocks` runs, and navigation
   *  changes no blocks. `column` is clamped against the target's edge line. */  const handleNavigateUp = (blockId: BlockId, column: number) => {
    const doc = docRef.current;
    if (!doc || !blocks) return;

    const targetId = idBeforeInOrder(order, blockId);
    if (targetId === null) return;

    const el = elementsRef.current.get(targetId);
    if (!el) return;

    const targetText = liveTextOf(doc.getRoot(), targetId);
    const lastLineStart = targetText.lastIndexOf("\n") + 1;
    const caret = lastLineStart + Math.min(column, targetText.length - lastLineStart);

    el.focus();
    el.setSelectionRange(caret, caret);
  };

  const handleNavigateDown = (blockId: BlockId, column: number) => {
    const doc = docRef.current;
    if (!doc || !blocks) return;

    const targetId = idAfterInOrder(order, blockId);
    if (targetId === null) return;

    const el = elementsRef.current.get(targetId);
    if (!el) return;

    const targetText = liveTextOf(doc.getRoot(), targetId);
    const firstNewline = targetText.indexOf("\n");
    const firstLineLength = firstNewline === -1 ? targetText.length : firstNewline;
    const caret = Math.min(column, firstLineLength);

    el.focus();
    el.setSelectionRange(caret, caret);
  };

  /** Removes a block outright (FR-022-05) — what a PDF block's delete button
   *  calls, having no caret to Backspace in. `BlockNotFoundError` means a peer
   *  got there first, which is the outcome this asked for. */
  const handleDeleteBlock = (blockId: BlockId) => {
    if (!applyEdit((_root, blocks) => removeBlock(blocks, blockId))) return;

    ensureTrailingEmptyBlock();
  };

  /** Read synchronously — a `DataTransfer` is only valid for the duration of the
   *  event, so the `File`s must come out before the first `await`. */
  const droppedFiles = (event: React.DragEvent): Array<File> =>
    Array.from(event.dataTransfer.files ?? []);

  /** Reorder (FR-022-04) — the three places a drag can land, and why the id rides
   *  the transfer data: `docs/design/document-editing.md`. */
  const handleDrop = (
    event: React.DragEvent<HTMLDivElement>,
    targetId: BlockId,
    forcedBefore?: boolean,
  ) => {
    event.preventDefault();
    // A drop on a block also reaches the container below it, which is where a
    // drop into the empty space under the document is handled. Only one of the
    // two should act on this file.
    event.stopPropagation();
    const draggedBlockId = event.dataTransfer.getData("text/plain");
    setDraggedId(null);
    setDropIndicator(null);

    if (!blocks) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const before =
      forcedBefore ?? dropsBeforeTarget(event.clientY, rect.top, rect.height);

    // Desktop drags carry files, handle drags carry a block id — one branch, and
    // the file lands where the pointer is (UC-022 기본 흐름 1).
    const files = droppedFiles(event);
    if (files.length > 0) {
      void uploadPdfs(files, before ? idBeforeInOrder(order, targetId) : targetId);
      return;
    }

    if (!draggedBlockId) return;

    const destination = dropDestination(order, draggedBlockId, targetId, before);
    if (!destination) return;

    applyEdit((_root, blocks) => moveBlockAfter(blocks, destination.afterId, draggedBlockId));
  };

  if (failed) {
    return <p className="text-sm text-red-600">문서를 열지 못했습니다. 새로고침해 주세요.</p>;
  }

  if (!client || blocks === null) {
    return <p className="text-sm text-ink-faint">여는 중…</p>;
  }

  const listNumbers = orderedListNumbers(blocks);
  const lastBlockId = order[order.length - 1] ?? null;

  /** One block's body, chosen by surface so a new type cannot reach here without
   *  the table gaining an entry. `isTextBearing`, not `surface === "text"`, is
   *  what narrows `Block` to something with `.text`. */
  const rowFor = (block: Block, index: number) => {
    if (isTextBearing(block)) {
      return (
        // A fixed two-slot row, not a conditional wrapper: the marker slot is
        // *always* a `<span>` here, present or empty, so `TextBlockView`'s own
        // position among its siblings never shifts across a type conversion —
        // the thing that was remounting it (and dropping focus) when the marker
        // used to live conditionally inside `TextBlockView` itself.
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex size-6 shrink-0 justify-center text-[14px] text-ink-faint select-none">
            {block.type === "checklist" ? (
              <input
                type="checkbox"
                checked={block.checked}
                onChange={() => handleToggleChecklist(block.id)}
                className="mt-1 size-3.5 cursor-pointer"
              />
            ) : block.type === "list" ? (
              block.style === "ordered" ? (
                `${listNumbers[index]}.`
              ) : (
                "•"
              )
            ) : null}
          </span>
          <TextBlockView
            blockId={block.id}
            initialText={block.text}
            variant={variantOf(block)}
            docRef={docRef}
            registerRemoteHandler={registerRemoteHandler}
            registerTextarea={registerTextarea}
            onMarkdownShortcut={handleMarkdownShortcut}
            onSplit={handleSplit}
            onMergeWithPrevious={handleMergeWithPrevious}
            onNavigateUp={handleNavigateUp}
            onNavigateDown={handleNavigateDown}
            onTextCommitted={ensureTrailingEmptyBlock}
            onSlashSelect={handleSlashSelect}
          />
        </div>
      );
    }

    // Bound to a const so the switch narrows it — TypeScript re-evaluates a
    // property access on each `case` and will not carry the narrowing across.
    const surface = BLOCK_KINDS[block.type].surface;

    switch (surface) {
      case "embed":
        // PDF is the only embed with a renderer: the image and generic-file
        // legs of FR-022-14 are refused at the upload endpoint until they have
        // one, so a block of either kind can only have come from elsewhere.
        return block.type === "pdf" ? (
          <PdfBlockView block={block} onDelete={handleDeleteBlock} />
        ) : (
          <UnsupportedBlock type={block.type} />
        );

      case "none":
        return block.type === "divider" ? (
          <DividerBlockView block={block} onDelete={handleDeleteBlock} />
        ) : (
          <UnsupportedBlock type={block.type} />
        );

      // The two link blocks wait on the document tree (UC-021/023), which is
      // what would give them a `documentId` to point at.
      case "link":
        return <UnsupportedBlock type={block.type} />;

      default: {
        // Not padding: a fifth `BlockSurface` stops this compiling until it has
        // a case. ("text" cannot reach here — TS rejects that case as unreachable.)
        const unhandled: never = surface;
        void unhandled;

        return <UnsupportedBlock type={block.type} />;
      }
    }
  };

  /** Drawn from the same `dropDestination` answer `handleDrop` acts on, so the
   *  line never promises a position the release declines. */
  const showIndicator = (targetId: BlockId, before: boolean) => {
    const next =
      draggedId === null || dropDestination(order, draggedId, targetId, before)
        ? { targetId, before }
        : null;
    setDropIndicator((current) =>
      current?.targetId === next?.targetId && current?.before === next?.before
        ? current
        : next,
    );
  };

  return (
    // The whole editor is a drop target, not only the blocks in it: a document
    // whose last block is short leaves most of the page empty, and that empty
    // space is where a file naturally gets dropped. A drop that lands on a
    // block stops there (`handleDrop`) and lands at the pointer instead.
    <div
      ref={scrollContainerRef}
      data-focus-scroll
      // `relative` makes this each block's `offsetParent` — the space
      // `lib/focus/dom.ts` reads `offsetTop` in.
      // `-ml-4 pl-4` is one thing: a non-`visible` overflow on one axis computes
      // the other to `auto`, so `overflow-y-auto` would clip the drag handle at
      // `-left-4`. Delete either half and the handle silently stops appearing.
      className="relative -ml-4 flex min-h-0 flex-1 flex-col overflow-y-auto pl-4"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          return;
        }
        // The padding strip beside the blocks: nothing to drop onto, so no
        // `preventDefault` and the line is cleared (document-editing.md).
        setDropIndicator(null);
      }}
      onDrop={(event) => {
        const files = droppedFiles(event);
        if (files.length === 0) return;
        event.preventDefault();
        void uploadPdfs(files, null);
      }}
    >
      {blocks.map((block, index) => (
        // `group`/`relative` here, not on the drag handle: the handle needs
        // to be positioned against this block and shown only while this
        // block's own textarea has focus (`group-focus-within`), pure CSS —
        // no JS state tracking "which block is focused" needed.
        <div
          key={block.id}
          data-block-id={block.id}
          className={`group relative ${
            block.id === draggedId ? "rounded-md bg-paper-2 opacity-50" : ""
          } ${
            dropIndicator?.targetId === block.id
              ? dropIndicator.before
                ? "border-t-2 border-sky-deep"
                : "border-b-2 border-sky-deep"
              : ""
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            // The container below also listens, to notice the pointer
            // sitting somewhere no block is. This *is* a block, so it
            // answers for itself.
            event.stopPropagation();
            const rect = event.currentTarget.getBoundingClientRect();
            showIndicator(block.id, dropsBeforeTarget(event.clientY, rect.top, rect.height));
          }}
          onDrop={(event) => handleDrop(event, block.id)}
        >
          <span
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("text/plain", block.id);
              setDraggedId(block.id);
            }}
            onDragEnd={() => {
              setDraggedId(null);
              setDropIndicator(null);
            }}
            className="absolute -left-4 top-0.5 cursor-grab text-ink-faint opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
          >
            {/* A Unicode glyph (⠿ and friends) depends on the guest's font
             * having that specific block — Braille Patterns is one of the
             * least reliably covered ranges across OSes. An inline SVG
             * renders identically everywhere a browser does, with no font
             * dependency at all. */}
            <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
              <circle cx="2.5" cy="2.5" r="1.5" />
              <circle cx="7.5" cy="2.5" r="1.5" />
              <circle cx="2.5" cy="8" r="1.5" />
              <circle cx="7.5" cy="8" r="1.5" />
              <circle cx="2.5" cy="13.5" r="1.5" />
              <circle cx="7.5" cy="13.5" r="1.5" />
            </svg>
          </span>
          {rowFor(block, index)}
        </div>
      ))}

      {/* Below the document rather than above it: this appends, and the
       * button sitting where the new block will appear is less surprising
       * than a toolbar. It also gives the empty half of the page something
       * to say — a drop target nobody can see is a feature nobody finds. */}
      <div
        // `cursor-text` so the empty space says what it does before it is
        // clicked: an I-beam over blank page is the convention for "there is
        // writing here to land in". The button inside sets its own
        // `cursor-pointer`, which wins over this on the part that is not empty.
        className="mt-3 flex flex-1 cursor-text flex-wrap items-center gap-2 pt-1"
        // Only a click on this div itself, never one that landed on the button
        // or the hint inside it — `currentTarget` is the empty space, `target`
        // is whatever was actually under the pointer.
        onClick={(event) => {
          if (event.target === event.currentTarget) focusEndOfDocument();
        }}
        // `flex-1`: the empty space under the document, which is where "put it
        // at the end" lands. Files bubble to the container, which appends them.
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files")) return;
          if (lastBlockId === null) return;
          event.preventDefault();
          event.stopPropagation();
          showIndicator(lastBlockId, false);
        }}
        onDrop={(event) => {
          if (lastBlockId === null || droppedFiles(event).length > 0) return;
          handleDrop(event, lastBlockId, false);
        }}
      >
        <label
          className={`rounded-md border border-ink bg-paper-2 px-2.5 py-1 text-[11px] font-semibold text-ink ${
            uploading ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-sky-soft"
          }`}
        >
          PDF 추가
          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            disabled={uploading}
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              // Cleared so picking the *same* file again still fires a change
              // event — otherwise a failed upload cannot be retried from here.
              event.target.value = "";
              // Set only when the `/` menu opened this picker; the button below
              // leaves it null, which still means "at the end".
              const anchor = pdfAnchorRef.current;
              pdfAnchorRef.current = null;
              if (files.length > 0) void uploadPdfs(files, anchor);
            }}
          />
        </label>

        {uploading ? (
          <span className="text-[11px] text-ink-faint">올리는 중…</span>
        ) : uploadError ? (
          <span className="text-[11px] text-red-600">{uploadError}</span>
        ) : (
          <span className="text-[11px] text-ink-faint">
            PDF 파일을 문서에 끌어다 놓을 수도 있습니다.
          </span>
        )}
      </div>
    </div>
  );
}
