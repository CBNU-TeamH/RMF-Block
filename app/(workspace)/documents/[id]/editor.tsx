"use client";

import yorkie, { type Document, type EditOpInfo } from "@yorkie-js/sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createPdf, createText } from "@/lib/blocks/create";
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
import { blockIndexFromEditPath } from "@/lib/blocks/text-surface";
import type { Block, BlockId, BlockType } from "@/lib/blocks/types";
import { anchorAt, scrollTopFor, type FocusAnchor } from "@/lib/focus/anchor";
import { readBoxes } from "@/lib/focus/dom";

import { useFocusFollow } from "../../focus-follow-provider";
import { useWorkspacePresence } from "../../presence-provider";
import { PdfBlockView } from "./pdf-block";
import { TextBlockView, type BlockVariant } from "./text-block";

/**
 * How often a presenter's anchor may go out over presence, at most.
 *
 * ponytail: a plain interval, no easing or adaptive cadence. 10 a second is
 * well under what a follower can perceive as lag — their side scrolls
 * smoothly between anchors anyway — and it is 6x fewer writes than the
 * display's frame rate. Lower it if following ever reads as steppy.
 */
const PUBLISH_MS = 100;

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
  // The scroll container from the render below (`data-focus-scroll`) — read
  // by both the presenter effect (this browser's own scroll → published
  // anchor) and the follower effect (a followed anchor → `scrollTo`).
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  // The last `FocusAnchor` this browser published while presenting. Not
  // `blocks` state — it exists purely to satisfy "only publish when the
  // anchor actually changed" without recomputing what was last sent from
  // presence itself.
  const lastPublishedAnchorRef = useRef<FocusAnchor | null>(null);
  // The last scroll target this browser *commanded* while following, so an
  // unchanged target is never re-issued. `scrollTo({ behavior: "smooth" })`
  // aborts an in-flight smooth scroll and restarts its easing curve from
  // wherever it had reached, so re-issuing the same target faster than the
  // animation completes leaves the follower creeping and never arriving —
  // measured as "it just doesn't follow" with the effect firing correctly
  // every time. Not `scrollTop`: that reads where the animation *is*, not
  // where it was told to go.
  const lastScrolledToRef = useRef<number | null>(null);
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

  // Whether the editor has finished loading, as a value that changes once
  // rather than on every recompute — see the presenter effect's own note.
  const blocksLoaded = blocks !== null;

  // The block ids in render order, which is the one thing `blocks` state is
  // reliable for (its `text` goes stale the moment anyone types — see
  // `liveTextOf`). Derived once instead of at each of the five places that
  // used to rebuild the same array: merge, both arrow-key handlers, the drop
  // handler and the render body.
  const order = useMemo(() => blocks?.map((block) => block.id) ?? [], [blocks]);

  // The followed member's anchor, pulled apart into primitives. The effects
  // below depend on these rather than on `members`, which `rosterFrom`
  // rebuilds on every presence event: an anchor that has not moved should not
  // re-run anything. Same lesson `presence-provider.tsx`'s header already
  // records for its own connection effect ("a fresh object every render would
  // give the effect a new dependency every render").
  const followed = followingId
    ? (members.find((m) => m.id === followingId)?.presenting ?? null)
    : null;
  const followedDocumentId = followed?.documentId ?? null;
  const followedBlockId = followed?.blockId ?? null;
  const followedRatio = followed?.ratio ?? null;

  // Presenter side (FR-030-07): while this browser is presenting, publish
  // this scroller's anchor as it moves. `isPresenting` is `presence-provider
  // .tsx`'s own local state, set synchronously by `setPresenting` — not read
  // back off `members` (this browser's own row echoed through Yorkie's
  // `'my-presence'` channel), because every publish below would then change
  // `members` and re-run this very effect: tear down the scroll listener,
  // publish once up front again, re-attach — churn that can drop a native
  // `scroll` event landing in the gap. See presence-provider.tsx's
  // `isPresenting` doc comment.
  //
  // Throttled to one publish per `PUBLISH_MS`, trailing edge included, and
  // skipped when the anchor has not actually changed.
  useEffect(() => {
    if (!isPresenting) {
      lastPublishedAnchorRef.current = null;
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let publishedAt = 0;

    const publish = () => {
      timer = null;
      const anchor = anchorAt(readBoxes(container), container.scrollTop);
      if (!anchor) return;

      const last = lastPublishedAnchorRef.current;
      if (last && last.blockId === anchor.blockId && last.ratio === anchor.ratio) {
        return;
      }

      lastPublishedAnchorRef.current = anchor;
      publishedAt = Date.now();
      setPresenting({ documentId, blockId: anchor.blockId, ratio: anchor.ratio });
    };

    // A wall-clock bound, not `requestAnimationFrame`: rAF bounds this to the
    // display's refresh rate, which is not a network cadence. Blocks are
    // short, so a scroll moves the anchor onto a *different block* every
    // couple of frames — the "has it changed?" check above passes almost
    // every time and ~60 presence writes a second go out, each one landing on
    // every follower as a re-render and a restarted smooth scroll.
    //
    // A pending timer is left alone rather than pushed back: it reads
    // `scrollTop` live when it fires, so it always publishes the newest
    // position, and it is the trailing edge — the last scroll of a gesture
    // schedules it, so the final resting position is never left unpublished.
    const onScroll = () => {
      if (timer !== null) return;
      timer = setTimeout(publish, Math.max(0, PUBLISH_MS - (Date.now() - publishedAt)));
    };

    // Published once up front too, not only on the next scroll — otherwise
    // starting a share (or presenting into a freshly opened document) would
    // leave the previous anchor standing until this browser's next scroll.
    onScroll();

    container.addEventListener("scroll", onScroll);
    return () => {
      container.removeEventListener("scroll", onScroll);
      if (timer !== null) clearTimeout(timer);
    };
    // `blocksLoaded`, a boolean that flips once — never `blocks` itself.
    // The container does not exist while `blocks` is still `null`, so this
    // effect needs one more chance once loading finishes; but `blocks` is a
    // fresh array on every recompute, and depending on it tore the scroll
    // listener down and rebuilt it continuously. A native `scroll` event
    // landing in that gap is dropped, which is what made following work
    // sometimes and not others. Nothing in here reads `blocks` anyway —
    // `readBoxes` measures the live DOM at publish time.
  }, [isPresenting, documentId, setPresenting, blocksLoaded]);

  // Follower side (FR-030-05/07): once joined (`followingId` set by
  // `FocusShare`) and looking at the same document the presenter is in
  // (cross-document navigation is `focus-follow-provider.tsx`'s job, not
  // this component's — it has to run even when no editor is mounted at
  // all), scroll to match every time the presenter's anchor changes.
  //
  // `blocks` is a dependency too, not just the presenter's own anchor:
  // a third person inserting blocks above the presenter moves every
  // `BlockBox`'s `top` without the anchor's `blockId`/`ratio` changing at
  // all, and only recomputing `scrollTopFor` against fresh boxes keeps the
  // follower on the same content through that (see the acceptance list).
  useEffect(() => {
    // Nothing to follow right now — not following anyone, the presenter has
    // no anchor yet, or they are in a different document. Forget the last
    // commanded position along with it: it exists only to stop the *same*
    // target being re-issued, and holding it across a pause would swallow
    // the first scroll after rejoining a presenter who never moved.
    if (
      !followingId ||
      followedBlockId === null ||
      followedRatio === null ||
      followedDocumentId !== documentId
    ) {
      lastScrolledToRef.current = null;
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const top = scrollTopFor(readBoxes(container), {
      blockId: followedBlockId,
      ratio: followedRatio,
    });
    // `null` means the anchor's block is gone — hold the current position
    // rather than jump anywhere, per `scrollTopFor`'s own documented contract.
    if (top === null) return;

    // Never re-issue a target already commanded: see `lastScrolledToRef`.
    // A pixel of slack because `top` is a float off live layout and a block's
    // height can wobble by sub-pixels between recomputes.
    const last = lastScrolledToRef.current;
    if (last !== null && Math.abs(top - last) <= 1) {
      return;
    }

    lastScrolledToRef.current = top;
    container.scrollTo({ top, behavior: "smooth" });
    // `blocks` stays a dependency on purpose, unlike the presenter effect
    // above: a third person inserting blocks above the presenter moves every
    // box's `top` without the anchor's own `blockId`/`ratio` changing at all,
    // and only recomputing against fresh boxes keeps the follower on the same
    // content through that (it is in the acceptance list).
  }, [
    followingId,
    followedDocumentId,
    followedBlockId,
    followedRatio,
    documentId,
    blocks,
  ]);

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
  const ensureTrailingEmptyBlock = () => {
    const doc = docRef.current;
    if (!doc) return;

    const root = doc.getRoot();
    const last = root.blocks[root.blocks.length - 1];
    const lastIsEmptyText = last?.type === "text" && (last.content?.text?.toString() ?? "") === "";
    if (lastIsEmptyText) return;

    applyEdit((_root, blocks) => appendBlock(blocks, toStoredBlock(createText())));
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
        const block = toStoredBlock(
          createPdf({ fileId: stored.id, fileName: stored.name, size: stored.size }),
        );

        const placed = applyEdit((root, array) => {
          // The anchor can be gone — a peer deleting that block while the
          // upload was in flight is exactly the window this covers. Appending
          // is the sensible fallback: the PDF still lands in the document.
          if (anchor !== null && !liveBlockOf(root, anchor)) anchor = null;

          if (anchor === null) appendBlock(array, block);
          else insertBlockAfter(array, anchor, block);
        });
        // The document closed mid-upload. The bytes are stored and orphaned,
        // which UC-050's file manager is the place to deal with; inventing a
        // block in a document nobody is attached to is not.
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
