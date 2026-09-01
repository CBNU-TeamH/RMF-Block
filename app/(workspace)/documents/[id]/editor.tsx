"use client";

import yorkie, { type Document, type EditOpInfo } from "@yorkie-js/sdk";
import { useCallback, useEffect, useRef, useState } from "react";

import { createChecklist, createList, createPdf, createQuote, createText } from "@/lib/blocks/create";
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
import { dropsBeforeTarget, idAfterInOrder, idBeforeInOrder } from "@/lib/blocks/reorder";
import { blockIndexFromEditPath } from "@/lib/blocks/text-surface";
import type { Block, BlockId } from "@/lib/blocks/types";

import { useWorkspacePresence } from "../../presence-provider";
import { PdfBlockView } from "./pdf-block";
import { TextBlockView, type BlockVariant } from "./text-block";

/** The six types that edit through `TextBlockView`'s one `<textarea>`. */
function isTextBearing(
  block: Block,
): block is Extract<Block, { text: string }> {
  return (
    block.type === "text" ||
    block.type === "heading" ||
    block.type === "list" ||
    block.type === "checklist" ||
    block.type === "quote" ||
    block.type === "code"
  );
}

/** What continues after this block on Enter — list/checklist/quote keep
 * their type (a running list stays a list, a quote stays a quote until an
 * empty line exits it); everything else's tail is plain text, matching how
 * heading already worked before these types joined it. Code never reaches
 * this at all for its "normal" Enter (it is a literal newline within the one
 * block, not a split) — only the exit case calls `onSplit`, and code isn't
 * in the list below, so that tail is plain text too, which is exactly what
 * leaving a code block means. */
function continuationBlock(original: Block | undefined): Block {
  if (original?.type === "list") return createList(original.style, original.depth);
  if (original?.type === "checklist") return createChecklist();
  if (original?.type === "quote") return createQuote();
  return createText();
}

function variantOf(block: Extract<Block, { text: string }>): BlockVariant {
  switch (block.type) {
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
    default:
      return { type: "text" };
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
  const { client } = useWorkspacePresence();
  const [blocks, setBlocks] = useState<Array<Block> | null>(null);
  const [failed, setFailed] = useState(false);
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
  // Uploads in flight, and the last one that failed. Both are about the
  // *request*, not the document: a PDF block only ever exists once its bytes
  // are stored, so there is no optimistic block to reconcile and nothing here
  // reaches Yorkie.
  //
  // A count rather than a flag, because a second drop while the first upload is
  // still running is a perfectly ordinary thing to do — and with a flag the
  // first one to finish would clear the indicator while the other was still
  // going.
  const [uploadsInFlight, setUploadsInFlight] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploading = uploadsInFlight > 0;

  const docRef = useRef<Document<BlockDocumentRoot> | null>(null);
  const handlersRef = useRef(new Map<BlockId, (op: EditOpInfo) => void>());
  // Chains one run's full teardown (unsubscribe + detach) in front of the
  // next run's attach(). React's Strict Mode double-invokes this effect on
  // mount (dev only) — mount → cleanup → mount, synchronously — which would
  // otherwise fire two attach()es back to back for the same document key
  // from the same client. Measured: the second one fails with a misleading
  // "client not found", because Yorkie's server-side TryAttaching filters on
  // the document not already being Attached for this client, and a cancelled
  // run whose attach() succeeded anyway was never detached — same shape as
  // `#32` in presence-provider.tsx, one layer deeper (the content document,
  // not the workspace one).
  const teardownRef = useRef<Promise<void>>(Promise.resolve());

  const registerRemoteHandler = (blockId: BlockId, handler: (op: EditOpInfo) => void) => {
    handlersRef.current.set(blockId, handler);
    return () => handlersRef.current.delete(blockId);
  };

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

  useEffect(() => {
    if (!client) return;

    const doc = new yorkie.Document<BlockDocumentRoot>(documentId);
    let cancelled = false;
    // Whether THIS run's attach() itself went through — independent of
    // `cancelled`, and independent of `docRef`, which a cancelled run never
    // gets to touch.
    let attached = false;
    let unsubscribe: (() => void) | undefined;

    // React runs cleanup(N) before effect(N+1) even in Strict Mode's
    // synchronous double-invoke, so whatever `teardownRef.current` holds here
    // is exactly the previous run's full teardown — attach() below waits for
    // it, so it never reaches the server while that run's document is still
    // marked Attached.
    const readyToAttach = teardownRef.current;

    const setup = (async () => {
      await readyToAttach;
      if (cancelled) return;

      await client.attach(doc, { initialPresence: {} });
      attached = true;
      if (cancelled) return;

      // Two people opening the same brand-new document at once could both
      // see it empty and both seed it — last-write-wins on `blocks` as a
      // whole, so one seed's block would replace the other's outright. The
      // same category of race `changeBlockType` already accepts for a
      // conversion two people make at once; worth measuring properly
      // (`#42`) if it ever turns out to matter at this app's scale.
      doc.update((root: BlockDocumentRoot) => {
        if (!root.blocks || root.blocks.length === 0) {
          root.blocks = [toStoredBlock(createText())];
        }
      });

      docRef.current = doc;
      setBlocks(readBlocks(doc.getRoot().blocks));

      unsubscribe = doc.subscribe((event) => {
        if (event.type !== "remote-change") return;

        // Recomputed at most once per event, not once per matching op — a
        // markdown-shortcut conversion alone already produces two ("set" on
        // the block's `type`, "set" on its `content"), and a multi-block
        // paste or reorder could add more. Recomputing `blocks` is an O(n)
        // read of the whole array, so this only costs it once per batch
        // instead of once per op inside one.
        let needsRecompute = false;

        for (const op of event.value.operations) {
          if (op.type === "edit") {
            const index = blockIndexFromEditPath(op.path);
            if (index === null) continue;

            const id = doc.getRoot().blocks[index]?.id;
            if (id) handlersRef.current.get(id)?.(op);
            continue;
          }

          // Anything else touching the blocks array or a field inside one
          // block: split/merge/reorder (add/remove/move, path exactly
          // "$.blocks") or a markdown-shortcut conversion's set/remove on
          // the block's own fields (`changeBlockType` sets `type` at
          // "$.blocks.<i>" and level/style/checked at
          // "$.blocks.<i>.content" — a peer's heading conversion was
          // otherwise invisible here until a later, unrelated edit finally
          // recomputed `blocks` for some other reason). Recomputed rather
          // than patched either way: unlike a text edit there is no single
          // DOM node whose value moved, the rendered list itself is stale.
          if (op.path === "$.blocks" || op.path.startsWith("$.blocks.")) {
            needsRecompute = true;
          }
        }

        if (needsRecompute) setBlocks(readBlocks(doc.getRoot().blocks));
      });
    })().catch((error: unknown) => {
      if (cancelled) return;
      setFailed(true);
      console.error(`Could not open document ${documentId}`, error);
    });

    return () => {
      cancelled = true;

      // Own this run's teardown and publish it before any of it actually
      // runs, so the next run's `readyToAttach` waits on exactly this.
      const teardown = setup.finally(async () => {
        unsubscribe?.();
        if (docRef.current === doc) docRef.current = null;
        // Only this run's own successful attach leaves something to
        // release — a run cancelled before attach() resolved never touched
        // the server, so detaching it would be a no-op at best.
        if (attached) await client.detach(doc).catch(() => undefined);
      });

      teardownRef.current = teardown;
    };
  }, [client, documentId]);

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
  const ensureTrailingEmptyBlock = () => {
    const doc = docRef.current;
    if (!doc) return;

    const root = doc.getRoot();
    const last = root.blocks[root.blocks.length - 1];
    const lastIsEmptyText = last?.type === "text" && (last.content?.text?.toString() ?? "") === "";
    if (lastIsEmptyText) return;

    doc.update((root: BlockDocumentRoot) => {
      appendBlock(root.blocks as BlockArray, toStoredBlock(createText()));
    });
    setBlocks(readBlocks(doc.getRoot().blocks));
  };

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
    const doc = docRef.current;
    if (!doc) return;

    try {
      doc.update((root: BlockDocumentRoot) => {
        const array = root.blocks as BlockArray;
        const current = liveTextOf(root, blockId);
        editBlockText(array, blockId, 0, current.length, "");
        changeBlockType(array, blockId, shortcut);
      });
    } catch (error) {
      if (error instanceof BlockNotFoundError) return;
      throw error;
    }

    setBlocks(readBlocks(doc.getRoot().blocks));
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
    const doc = docRef.current;
    if (!doc) return;

    try {
      doc.update((root: BlockDocumentRoot) => {
        const array = root.blocks as BlockArray;
        const checked = liveBlockOf(root, blockId)?.content?.checked === true;
        changeBlockType(array, blockId, { type: "checklist", checked: !checked });
      });
    } catch (error) {
      if (error instanceof BlockNotFoundError) return;
      throw error;
    }

    setBlocks(readBlocks(doc.getRoot().blocks));
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
    const doc = docRef.current;
    if (!doc || !blocks) return;

    const original = blocks.find((block) => block.id === blockId);
    let newBlockId: BlockId | null = null;

    try {
      doc.update((root: BlockDocumentRoot) => {
        const array = root.blocks as BlockArray;
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
    } catch (error) {
      if (error instanceof BlockNotFoundError) return;
      throw error;
    }

    // Local structural change — the subscribe callback above only reacts to
    // `remote-change`, so this is the only place this list update happens.
    setBlocks(readBlocks(doc.getRoot().blocks));
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
    const doc = docRef.current;
    if (!doc || !blocks) return;

    const previousId = idBeforeInOrder(
      blocks.map((b) => b.id),
      blockId,
    );
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

    try {
      doc.update((root: BlockDocumentRoot) => {
        const array = root.blocks as BlockArray;
        const previousText = liveTextOf(root, previousId);
        const thisText = liveTextOf(root, blockId);
        mergeCaret = previousText.length;

        editBlockText(array, previousId, previousText.length, previousText.length, thisText);
        removeBlock(array, blockId);
      });
    } catch (error) {
      if (error instanceof BlockNotFoundError) return;
      throw error;
    }

    setBlocks(readBlocks(doc.getRoot().blocks));
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

    const targetId = idBeforeInOrder(
      blocks.map((b) => b.id),
      blockId,
    );
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

    const targetId = idAfterInOrder(
      blocks.map((b) => b.id),
      blockId,
    );
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
    const doc = docRef.current;
    if (!doc) return;

    try {
      doc.update((root: BlockDocumentRoot) => {
        removeBlock(root.blocks as BlockArray, blockId);
      });
    } catch (error) {
      if (error instanceof BlockNotFoundError) return;
      throw error;
    }

    setBlocks(readBlocks(doc.getRoot().blocks));
    ensureTrailingEmptyBlock();
  };

  /**
   * Uploads dropped or picked PDFs and puts a block for each one into the
   * document (FR-022-13, FR-022-14).
   *
   * **The upload finishes before the block exists.** The alternative — a
   * placeholder block that fills in when the bytes land — would mean every
   * other client on the LAN seeing a block pointing at a `fileId` the server
   * has not issued yet, and a failed upload leaving one behind permanently.
   * The cost is that a large file shows nothing but the "올리는 중" line for a
   * few seconds, which is the honest state of affairs.
   *
   * Several files at once are uploaded in order, each anchored after the last,
   * so three PDFs dropped together land in the order they were dropped rather
   * than in whatever order their requests happened to finish.
   */
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
          // The endpoint phrases its own refusals in Korean and they are the
          // useful part — "PDF만" and "25MB 이하" are what the person has to
          // act on. A body that is not the JSON we expect falls back.
          const body = await response.json().catch(() => null);
          throw new Error(body?.error ?? "파일을 올리지 못했습니다.");
        }

        const stored = await response.json();
        const doc = docRef.current;
        // The document closed mid-upload. The bytes are stored and orphaned,
        // which UC-050's file manager is the place to deal with; inventing a
        // block in a document nobody is attached to is not.
        if (!doc) return;

        const block = toStoredBlock(
          createPdf({ fileId: stored.id, fileName: stored.name, size: stored.size }),
        );

        doc.update((root: BlockDocumentRoot) => {
          const array = root.blocks as BlockArray;
          // The anchor can be gone — a peer deleting that block while the
          // upload was in flight is exactly the window this covers. Appending
          // is the sensible fallback: the PDF still lands in the document.
          if (anchor !== null && !liveBlockOf(root, anchor)) anchor = null;

          if (anchor === null) appendBlock(array, block);
          else insertBlockAfter(array, anchor, block);
        });

        anchor = block.id;
        setBlocks(readBlocks(doc.getRoot().blocks));
      }

      ensureTrailingEmptyBlock();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "파일을 올리지 못했습니다.");
    } finally {
      setUploadsInFlight((n) => n - 1);
    }
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
   * `afterId` resolves "insert before/after `targetId`" the same way merge
   * resolves "the previous block" — off `blocks` state's order, which is
   * reliable for order even though its `text` fields go stale
   * (`liveTextOf`'s own comment). Two no-ops guarded explicitly: dropping a
   * block onto itself, and a drop that resolves to the position the block
   * is already in — without the second, dropping back onto its own current
   * neighbor still calls `moveBlockAfter` for no actual change.
   */
  const handleDrop = (event: React.DragEvent<HTMLDivElement>, targetId: BlockId) => {
    event.preventDefault();
    // A drop on a block also reaches the container below it, which is where a
    // drop into the empty space under the document is handled. Only one of the
    // two should act on this file.
    event.stopPropagation();
    const draggedBlockId = event.dataTransfer.getData("text/plain");
    setDraggedId(null);
    setDropIndicator(null);

    const doc = docRef.current;
    if (!doc || !blocks) return;

    const order = blocks.map((b) => b.id);
    const rect = event.currentTarget.getBoundingClientRect();
    const before = dropsBeforeTarget(event.clientY, rect.top, rect.height);

    // A drag from the desktop carries files; a drag from the drag handle
    // carries a block id. Same event, same handler, one branch — the file case
    // lands where the pointer is, exactly as a reorder would (UC-022 기본 흐름 1,
    // "파일을 문서에 드래그 앤 드롭한다").
    const files = droppedFiles(event);
    if (files.length > 0) {
      void uploadPdfs(files, before ? idBeforeInOrder(order, targetId) : targetId);
      return;
    }

    if (!draggedBlockId || draggedBlockId === targetId) return;

    const afterId = before ? idBeforeInOrder(order, targetId) : targetId;

    const currentAfterId = idBeforeInOrder(order, draggedBlockId);
    if (afterId === draggedBlockId || afterId === currentAfterId) return;

    try {
      doc.update((root: BlockDocumentRoot) => {
        moveBlockAfter(root.blocks as BlockArray, afterId, draggedBlockId);
      });
    } catch (error) {
      if (error instanceof BlockNotFoundError) return;
      throw error;
    }

    setBlocks(readBlocks(doc.getRoot().blocks));
  };

  if (failed) {
    return <p className="text-sm text-red-600">문서를 열지 못했습니다. 새로고침해 주세요.</p>;
  }

  if (!client || blocks === null) {
    return <p className="text-sm text-ink-faint">여는 중…</p>;
  }

  const listNumbers = orderedListNumbers(blocks);

  return (
    // The whole editor is a drop target, not only the blocks in it: a document
    // whose last block is short leaves most of the page empty, and that empty
    // space is where a file naturally gets dropped. A drop that lands on a
    // block stops there (`handleDrop`) and lands at the pointer instead.
    <div
      className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      onDragOver={(event) => {
        // Only for files. Calling `preventDefault` for everything would make
        // this a valid drop target for a block being reordered too, and a
        // block dropped here would silently do nothing.
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
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
            const rect = event.currentTarget.getBoundingClientRect();
            const before = dropsBeforeTarget(event.clientY, rect.top, rect.height);
            setDropIndicator((current) =>
              current?.targetId === block.id && current.before === before
                ? current
                : { targetId: block.id, before },
            );
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
          {isTextBearing(block) ? (
            // A fixed two-slot row, not a conditional wrapper: the marker
            // slot is *always* a `<span>` here, present or empty, so
            // `TextBlockView`'s own position among its siblings never
            // shifts across a type conversion — the thing that was
            // remounting it (and dropping focus) when the marker used to
            // live conditionally inside `TextBlockView` itself.
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
          ) : block.type === "pdf" ? (
            <PdfBlockView block={block} onDelete={handleDeleteBlock} />
          ) : (
            // Divider/file/image/doc-link/block-link: typed already, no
            // renderer yet — dividers are next (they need their own
            // no-textarea operation, unlike these four which just reused
            // `changeBlockType` as-is), and image/file wait on the other two
            // legs of FR-022-14, which the upload endpoint refuses for now.
            <p className="px-1 py-0.5 text-sm text-ink-faint">
              아직 편집할 수 없는 블록입니다 ({block.type}).
            </p>
          )}
        </div>
      ))}

      {/* Below the document rather than above it: this appends, and the
       * button sitting where the new block will appear is less surprising
       * than a toolbar. It also gives the empty half of the page something
       * to say — a drop target nobody can see is a feature nobody finds. */}
      <div className="mt-3 flex flex-1 flex-wrap items-center gap-2 pt-1">
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
