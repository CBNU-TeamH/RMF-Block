"use client";

import yorkie, { type Document, type EditOpInfo } from "@yorkie-js/sdk";
import { useCallback, useEffect, useRef, useState } from "react";

import { createText } from "@/lib/blocks/create";
import { readBlocks, toStoredBlock, type BlockDocumentRoot } from "@/lib/blocks/document";
import {
  appendBlock,
  BlockNotFoundError,
  changeBlockType,
  editBlockText,
  insertBlockAfter,
  removeBlock,
  type BlockArray,
} from "@/lib/blocks/operations";
import { idBeforeInOrder } from "@/lib/blocks/reorder";
import { blockIndexFromEditPath } from "@/lib/blocks/text-surface";
import type { Block, BlockId, HeadingLevel } from "@/lib/blocks/types";

import { useWorkspacePresence } from "../../presence-provider";
import { TextBlockView } from "./text-block";

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
    if (!el) return;

    pendingFocusRef.current = null;
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
            setBlocks(readBlocks(doc.getRoot().blocks));
          }
        }
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
  function liveTextOf(root: BlockDocumentRoot, blockId: BlockId): string {
    for (const stored of root.blocks) {
      if (stored?.id === blockId) return stored.content?.text?.toString() ?? "";
    }
    return "";
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
  const handleMarkdownShortcut = (blockId: BlockId, level: HeadingLevel) => {
    const doc = docRef.current;
    if (!doc) return;

    try {
      doc.update((root: BlockDocumentRoot) => {
        const array = root.blocks as BlockArray;
        const current = liveTextOf(root, blockId);
        editBlockText(array, blockId, 0, current.length, "");
        changeBlockType(array, blockId, { type: "heading", level });
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
   * `BlockNotFoundError` means a peer already removed this block (their
   * merge, most likely) before this split reached it — nothing left to
   * split, so this replica does nothing further and lets the other
   * replica's operation stand.
   */
  const handleSplit = (blockId: BlockId, cursorPosition: number) => {
    const doc = docRef.current;
    if (!doc) return;

    const newBlock = toStoredBlock(createText());

    try {
      doc.update((root: BlockDocumentRoot) => {
        const array = root.blocks as BlockArray;
        const liveText = liveTextOf(root, blockId);
        const tail = liveText.slice(cursorPosition);

        editBlockText(array, blockId, cursorPosition, liveText.length, "");
        insertBlockAfter(array, blockId, newBlock);
        if (tail) editBlockText(array, newBlock.id, 0, 0, tail);
      });
    } catch (error) {
      if (error instanceof BlockNotFoundError) return;
      throw error;
    }

    // Local structural change — the subscribe callback above only reacts to
    // `remote-change`, so this is the only place this list update happens.
    setBlocks(readBlocks(doc.getRoot().blocks));
    focusBlock(newBlock.id, 0);
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

  if (failed) {
    return <p className="text-sm text-red-600">문서를 열지 못했습니다. 새로고침해 주세요.</p>;
  }

  if (!client || blocks === null) {
    return <p className="text-sm text-ink-faint">여는 중…</p>;
  }

  return (
    <div className="flex flex-col">
      {blocks.map((block) =>
        block.type === "text" || block.type === "heading" ? (
          <TextBlockView
            key={block.id}
            blockId={block.id}
            initialText={block.text}
            headingLevel={block.type === "heading" ? block.level : undefined}
            docRef={docRef}
            registerRemoteHandler={registerRemoteHandler}
            registerTextarea={registerTextarea}
            onMarkdownShortcut={handleMarkdownShortcut}
            onSplit={handleSplit}
            onMergeWithPrevious={handleMergeWithPrevious}
            onTextCommitted={ensureTrailingEmptyBlock}
          />
        ) : (
          // Nothing before milestone 4 can create these, but the array is
          // read off whatever is actually in the document, not what this
          // build wrote — the same reason `readBlocks` drops rather than
          // crashes on a type it does not know.
          <p key={block.id} className="px-1 py-0.5 text-sm text-ink-faint">
            아직 편집할 수 없는 블록입니다 ({block.type}).
          </p>
        ),
      )}
    </div>
  );
}
