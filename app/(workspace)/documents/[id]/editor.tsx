"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createText } from "@/lib/blocks/create";
import { BLOCK_KINDS, continuationBlock, isTextBearing } from "@/lib/blocks/registry";
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
import type { Block, BlockId, BlockType } from "@/lib/blocks/types";

import { useFocusFollow } from "../../focus-follow-provider";
import { useWorkspacePresence } from "../../presence-provider";
import { PdfBlockView } from "./pdf-block";
import { TextBlockView, type BlockVariant } from "./text-block";
import { useBlockDocument } from "./use-block-document";
import { useFocusPresence } from "./use-focus-presence";
import { usePdfUpload } from "./use-pdf-upload";

/**
 * Exhaustive on purpose — every text-bearing type has its own `case`, and the
 * `never` below is what makes a seventh one a compile error here rather than a
 * block that silently renders as plain text. `BLOCK_KINDS` decides *which*
 * types reach this function; this decides how each of them looks.
 */
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

/**
 * Attaches `documentId` through the workspace's one Yorkie client
 * (`presence-provider.tsx`) and renders its blocks (FR-022-02, FR-022-09).
 *
 * A brand-new document arrives with no `blocks` at all — `POST /api/documents`
 * never touches Yorkie, on purpose, so creating one never needs a
 * server-side Yorkie client. Seeding `root.blocks = [text]` happens here
 * instead, the first time anyone opens it, matching UC-021's "생성된 문서의
 * 편집기를 사용자 편집 화면에 표시한다".
 *
 * One `doc.subscribe()` for the whole document, not one per block: a text
 * edit's path is positional (`$.blocks.<i>.content.text`), not by block id
 * (`document-editing.md`, "Subscribing to remote changes"), so the block a
 * path names is resolved fresh from the current array on every event instead
 * of being fixed at subscribe time.
 *
 * Milestone 2 only edits text within whatever blocks already exist — nothing
 * yet creates, deletes or moves one, so the block list itself is read once
 * after seeding and never recomputed. Milestone 3 is what makes that list
 * change.
 */
export function DocumentEditor({ documentId }: { documentId: string }) {
  const { client, members, isPresenting, setPresenting } = useWorkspacePresence();
  const { followingId } = useFocusFollow();
  const { blocks, setBlocks, failed, docRef, registerRemoteHandler } = useBlockDocument(
    client,
    documentId,
  );
  // The block currently being dragged — opacity feedback only, cleared on
  // both a successful drop and `dragend` (a drag cancelled or dropped
  // outside any block never fires `onDrop`, and without `dragend` too the
  // dragged block would stay dimmed).
  const [draggedId, setDraggedId] = useState<BlockId | null>(null);
  // Which block the pointer is currently over during a drag, and which side
  // of it a drop would land on — a Notion-style insertion line, not the
  // exact-midpoint precision `dropsBeforeTarget` computes for the actual
  // drop: this is feedback shown *while* dragging, so it only has to be
  // approximately where the block will land, not pixel-exact.
  const [dropIndicator, setDropIndicator] = useState<{
    targetId: BlockId;
    before: boolean;
  } | null>(null);

  // The scroll container from the render below (`data-focus-scroll`) — read
  // by both the presenter effect (this browser's own scroll → published
  // anchor) and the follower effect (a followed anchor → `scrollTo`).
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  // Same Map-based registration as `registerRemoteHandler`, one level up:
  // lets this component reach a specific block's live textarea by id, for
  // focus after a split or merge. `useCallback` so the identity stays
  // stable across re-renders — `text-block.tsx`'s own `setTextareaRef` is
  // memoized on this reference, and an inline arrow here would make it
  // re-run (tearing down and re-adding the Map entry) on every render.
  const elementsRef = useRef(new Map<BlockId, HTMLTextAreaElement>());
  const registerTextarea = useCallback((blockId: BlockId, el: HTMLTextAreaElement | null) => {
    if (el) elementsRef.current.set(blockId, el);
    else elementsRef.current.delete(blockId);
  }, []);

  // A pending "move focus here" request. A ref, not state: nothing here
  // needs its own render — the `setBlocks` call that always accompanies a
  // focus request is what re-renders, and the effect below rides that same
  // commit.
  const pendingFocusRef = useRef<{ blockId: BlockId; caret: number } | null>(null);
  const focusBlock = (blockId: BlockId, caret: number) => {
    pendingFocusRef.current = { blockId, caret };
  };

  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending) return;

    const el = elementsRef.current.get(pending.blockId);
    // Not registered — refs attach during React's commit, strictly before
    // any effect (child or parent) runs in that commit, so a block that
    // mounted this same render is already here. If it is not, the block
    // this request named is already gone (a second, faster edit removed it
    // first) — drop the request rather than guess where focus should land.
    // Cleared either way, and that matters: leaving it pending would let the
    // next unrelated `setBlocks` (a peer's remote change, or
    // `ensureTrailingEmptyBlock`) run this effect again and yank the caret
    // out of whatever block the person had since started typing in.
    pendingFocusRef.current = null;
    if (!el) return;
    el.focus();
    el.setSelectionRange(pending.caret, pending.caret);
  }, [blocks]);


  // Whether the editor has finished loading, as a value that changes once
  // rather than on every recompute — see the presenter effect's own note.
  const blocksLoaded = blocks !== null;

  // The block ids in render order, which is the one thing `blocks` state is
  // reliable for (its `text` goes stale the moment anyone types — see
  // `liveTextOf`). Derived once instead of at each of the five places that
  // used to rebuild the same array: merge, both arrow-key handlers, the drop
  // handler and the render body.
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

  /**
   * A block's *live* text by id, read straight off the document rather than
   * `blocks` state — that state's `text` field is a snapshot from whenever
   * it was last recomputed, and per-block textareas patch the DOM directly
   * without ever writing back into it, so it goes stale the moment anyone
   * types. Plain `for...of`, not `.find`: every existing read of a live
   * array in this codebase goes through iteration proven to work at
   * runtime (`operations.ts`'s own `elementOf` warns `JSONArray<T>`'s
   * `Array<T>` typing is a compile-time claim only — `unshift` type-checks
   * and throws) rather than an untried method.
   */
  function liveBlockOf(root: BlockDocumentRoot, blockId: BlockId): StoredBlock | null {
    for (const stored of root.blocks) {
      if (stored?.id === blockId) return stored;
    }
    return null;
  }

  function liveTextOf(root: BlockDocumentRoot, blockId: BlockId): string {
    return liveBlockOf(root, blockId)?.content?.text?.toString() ?? "";
  }

  /**
   * Runs one mutation against the live document and republishes the block
   * list. Every local edit in this component goes through here.
   *
   * Returns whether the edit landed, so a caller with follow-up work — moving
   * the caret, appending the trailing block — can tell. `false` means one of
   * two things, and neither is an error to report:
   *
   * - **No document.** The editor is not attached (yet, or any more).
   * - **`BlockNotFoundError`.** A peer removed the block this edit named
   *   before it got here — their merge or delete, most likely. That operation
   *   is the one that stands; there is nothing left on this replica to fix, and
   *   nothing sensible to tell the person who typed. This is the reason the
   *   error is swallowed rather than surfaced, and it is written here once
   *   instead of at each of the six call sites that used to repeat it.
   *
   * Two mutations deliberately cannot raise it and are no less safe for going
   * through the same door: `ensureTrailingEmptyBlock` only pushes, and the
   * upload's insert re-checks its anchor inside the update.
   *
   * `setBlocks` runs only on success and only here: the subscribe callback
   * reacts to `remote-change` alone, so a local structural change has no other
   * route to the rendered list.
   */
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

  /**
   * Keeps one empty text block always at the end of the document, so
   * starting a new paragraph never means clicking into whatever block a
   * peer happens to be actively typing in first — that was the only way in
   * before this, since nothing else was ever empty to click into.
   *
   * Checked after every local text commit. Idempotent — a no-op the moment
   * the invariant already holds — so calling it on every keystroke costs one
   * cheap read rather than risking a loop: appending a genuinely empty block
   * always satisfies the very next check.
   *
   * Local-only on purpose: each client enforces this only against its own
   * edits, and the resulting append reaches every other client through the
   * ordinary `add` op the subscribe callback above already recomputes
   * `blocks` for — nothing here needs to run again on a remote edit.
   */
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

  /**
   * A click on the empty space under the document puts the caret at the end of
   * it, the way clicking under any other page of text does.
   *
   * Without this the only way in was to hit one of the block rows exactly, and
   * the trailing empty block is a single line of text at the top of a mostly
   * empty page — a small target above a large expanse that looked clickable and
   * was not.
   *
   * Usually there is already an empty text block to land in: `ensureTrailingEmptyBlock`
   * runs after every text commit and keeps one there. When there is not — the
   * document ends in a PDF, say, because it was opened without this browser
   * having edited it yet — one is made, which is the same answer, just a block
   * later.
   */
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

  /**
   * A markdown marker just finished (`"# "` and friends — `text-block.tsx`
   * only ever calls this once the block's *entire* text matches one).
   * Clears the marker and converts the type in the same update, matching
   * `changeBlockType`'s own contract: it keeps the block's `id` and its
   * live `yorkie.Text`, so whatever a peer is concurrently typing into this
   * block survives the conversion rather than being lost to a rebuild.
   *
   * Wrapped for `BlockNotFoundError` for the same reason split/merge are —
   * a block a peer already removed can't be converted, and there is nothing
   * left to fix on this replica once that happens.
   */
  const handleMarkdownShortcut = (blockId: BlockId, shortcut: MarkdownShortcut) => {
    applyEdit((root, blocks) => {
      const current = liveTextOf(root, blockId);
      editBlockText(blocks, blockId, 0, current.length, "");
      changeBlockType(blocks, blockId, shortcut);
    });
  };

  /**
   * The checklist's own checkbox, clicked. Reads the *live* `checked` value
   * inside the same update rather than trusting `blocks` state's copy — a
   * peer toggling the same box a moment earlier is exactly the race
   * `changeBlockType`'s own docs accept for any primitive field, but reading
   * live at least means this click flips from whatever is actually there
   * right now, not a snapshot from the last render.
   */
  const handleToggleChecklist = (blockId: BlockId) => {
    applyEdit((root, blocks) => {
      const checked = liveBlockOf(root, blockId)?.content?.checked === true;
      changeBlockType(blocks, blockId, { type: "checklist", checked: !checked });
    });
  };

  /**
   * Enter (FR-022-01). Trims `blockId` to `[0, cursorPosition)` and seeds a
   * new block right after it with the tail — the same three-primitive
   * composition `operations.test.mts`'s "splits a block into two" already
   * proves, not a new named function (the task's own "reuse... as they
   * stand"). Reads the *live* text, never the DOM's cached value: a
   * concurrent remote edit past `cursorPosition` would otherwise be
   * silently dropped or misplaced.
   *
   * The new block continues the original's type for list/checklist/quote
   * (`continuationBlock`) — a running list stays a list until you leave it —
   * and pressing Enter on an *empty* list/checklist/quote item exits back to
   * plain text instead of splitting at all, the standard way to stop one
   * with no block-type menu to do it from otherwise.
   *
   * `BlockNotFoundError` means a peer already removed this block (their
   * merge, most likely) before this split reached it — nothing left to
   * split, so this replica does nothing further and lets the other
   * replica's operation stand.
   */
  const handleSplit = (blockId: BlockId, cursorPosition: number) => {
    if (!blocks) return;

    const original = blocks.find((block) => block.id === blockId);
    let newBlockId: BlockId | null = null;

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
    });
    if (!applied) return;

    focusBlock(newBlockId ?? blockId, 0);
  };

  /**
   * Backspace at the very start of a block (FR-022-03). Appends this
   * block's live text onto the end of the *previous* block's, then removes
   * this one. No previous block (this is the document's first) is a no-op.
   *
   * The previous block's id comes from `blocks` state's order — reliable
   * for order, unlike its `text` (see `liveTextOf`) — so both blocks' actual
   * content is still read live, inside the same update that mutates them.
   */
  const handleMergeWithPrevious = (blockId: BlockId) => {
    if (!blocks) return;

    const previousId = idBeforeInOrder(order, blockId);
    if (previousId === null) return;

    // A non-text-bearing previous block (divider, or any of the file/link
    // types nothing in this UI can create yet) has no `content.text` to
    // append into — `editBlockText` would throw a plain `Error`, not
    // `BlockNotFoundError`, and crash out of this handler uncaught. Such a
    // block can still arrive from another client on the LAN
    // (`document.ts`'s own documented no-auth threat model), so this is a
    // real case, not a hypothetical one. Treated the same as "no previous
    // block": nothing sensible to merge into, so do nothing.
    const previousBlock = blocks.find((block) => block.id === previousId);
    if (!previousBlock || !isTextBearing(previousBlock)) return;

    let mergeCaret = 0;

    const applied = applyEdit((root, array) => {
      const previousText = liveTextOf(root, previousId);
      const thisText = liveTextOf(root, blockId);
      mergeCaret = previousText.length;

      editBlockText(array, previousId, previousText.length, previousText.length, thisText);
      removeBlock(array, blockId);
    });
    if (!applied) return;

    focusBlock(previousId, mergeCaret);
  };

  /**
   * ArrowUp/ArrowDown from a block's first/last line. Focuses the target
   * directly — `elementsRef.current.get(id)?.focus()` — rather than going
   * through `focusBlock`/`pendingFocusRef`: that mechanism is only ever
   * consumed by the effect above because split/merge always call
   * `setBlocks` right after, giving the effect a reason to run. Navigation
   * never touches the block list, so a request placed through it would sit
   * unconsumed until some unrelated later edit happened to fire that
   * effect. The target here is always already mounted (unlike split's
   * brand-new block), so there is no "wait for it to render" problem the
   * ref+effect indirection is actually needed for.
   *
   * `column` is offset within the *source* line the caret was on; landing
   * it in the target means clamping against that target's *matching* edge
   * line, not its whole text — a multi-line block (Shift+Enter makes this
   * real, not hypothetical) would otherwise land the caret on the wrong
   * line entirely.
   */
  const handleNavigateUp = (blockId: BlockId, column: number) => {
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

  /**
   * Removes a block outright (FR-022-05). Text blocks reach this through
   * Backspace-at-the-start, which merges rather than deletes; a PDF block has
   * no caret to press Backspace in, so it carries its own delete button and
   * this is what that button calls.
   *
   * `BlockNotFoundError` means a peer removed it first — the outcome this was
   * asking for, so there is nothing to report.
   */
  const handleDeleteBlock = (blockId: BlockId) => {
    if (!applyEdit((_root, blocks) => removeBlock(blocks, blockId))) return;

    ensureTrailingEmptyBlock();
  };

  /**
   * The files a drag is carrying, or an empty array when it is carrying a
   * block being reordered instead. Read synchronously: a `DataTransfer` is only
   * valid for the duration of the event, so the `File` objects have to be taken
   * out before the first `await`.
   */
  const droppedFiles = (event: React.DragEvent): Array<File> =>
    Array.from(event.dataTransfer.files ?? []);

  /**
   * Reorder (FR-022-04) — native HTML5 drag-and-drop, the dragged block's
   * id carried as the browser's own transfer data rather than component
   * state, since `dragstart` and `drop` can fire on different renders.
   *
   * Where the block lands is `dropDestination`'s call, not this function's —
   * the same call the insertion line is drawn from, so the line and the drop
   * can never disagree about whether a position is real.
   *
   * `forcedBefore` is for callers that are not the target block itself: the
   * footer under the document drops at the end, and deriving "before or
   * after?" from *its* rect would answer about the footer, not about the
   * block.
   */
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

    // A drag from the desktop carries files; a drag from the drag handle
    // carries a block id. Same event, same handler, one branch — the file case
    // lands where the pointer is, exactly as a reorder would (UC-022 기본 흐름 1,
    // "파일을 문서에 드래그 앤 드롭한다").
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

  /**
   * One block's body, chosen by its **surface** rather than by its type
   * (`lib/blocks/registry.ts`). Four cases instead of a ternary chain that
   * grew a branch per type, and — the point of the exercise — a thirteenth
   * type cannot reach here without `BLOCK_KINDS` gaining an entry first, which
   * is a compile error until someone writes one.
   *
   * `isTextBearing` rather than `surface === "text"` for the first branch: the
   * two agree by construction (`Kind`'s own type enforces it), but only the
   * guard narrows `Block` down to something with a `.text` for `TextBlockView`.
   */
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

      // Divider, and the two link blocks: typed and stored already, no
      // renderer yet. A divider needs its own no-textarea operation; the link
      // blocks wait on the document tree (UC-021/023) that would give them a
      // `documentId`.
      case "none":
      case "link":
        return <UnsupportedBlock type={block.type} />;

      default: {
        // Not defensive padding: `never` holds only while every surface a
        // non-text block can have is handled above, so adding a fifth
        // `BlockSurface` stops this compiling until it has a case. ("text"
        // itself cannot reach here — `isTextBearing` returned above, and
        // `Kind` ties the two together, which TypeScript checks: a `case
        // "text"` here is rejected as unreachable.)
        const unhandled: never = surface;
        void unhandled;

        return <UnsupportedBlock type={block.type} />;
      }
    }
  };

  /**
   * Draw the insertion line — but only where a drop would actually land the
   * block somewhere, which is `dropDestination`'s answer, the very one
   * `handleDrop` acts on. A line over a position the drop declines is the
   * whole complaint: it says "here" and releasing does nothing.
   *
   * A file drag has no `draggedId`, and for it every position is a real
   * insertion point — a new block goes in wherever the pointer is — so it
   * always draws.
   */
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
      // `relative` so this container — not some further-out ancestor —
      // becomes each block's `offsetParent`: `lib/focus/dom.ts`'s
      // `readBoxes` reads `offsetTop` and needs it in this element's own
      // coordinate space, the same one `scrollTop` is measured in.
      //
      // `-ml-4 pl-4` is one thing, not two: it bleeds the container 16px left
      // into `<main>`'s `px-8` and gives that width straight back as padding,
      // so the blocks stay exactly where they were while the box that clips
      // them grows to cover the drag handle at `-left-4`. Needed because
      // `overflow-y-auto` clips *both* axes — per CSS, a non-`visible`
      // overflow on one axis computes the other's `visible` to `auto` — and
      // the handle sits outside the block's own left edge. Delete either half
      // and the handle silently disappears again: it starts at `opacity-0`,
      // so nothing errors, it just never shows on hover.
      className="relative -ml-4 flex min-h-0 flex-1 flex-col overflow-y-auto pl-4"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          return;
        }
        // A block drag reaching the container has passed every block and the
        // footer without being claimed — the pointer is in the padding strip
        // beside the blocks, where there is nothing to drop onto. No
        // `preventDefault`, so the browser shows "no drop"; the line goes too,
        // rather than being left over the last block crossed, promising a
        // landing spot the release would not honour.
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
        className="mt-3 flex flex-1 flex-wrap items-center gap-2 pt-1"
        // Only a click on this div itself, never one that landed on the button
        // or the hint inside it — `currentTarget` is the empty space, `target`
        // is whatever was actually under the pointer.
        onClick={(event) => {
          if (event.target === event.currentTarget) focusEndOfDocument();
        }}
        // This div is `flex-1`: it *is* the empty space under the document,
        // which is exactly where a block gets dragged when the intent is
        // "put it at the end". Before, nothing here claimed the drop, so the
        // browser refused it while the line drawn over the last block crossed
        // stayed on screen. Files are left to bubble to the container, which
        // already appends them.
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
              if (files.length > 0) void uploadPdfs(files, null);
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
