import { useEffect, useRef, type RefObject } from "react";

import { anchorAt, scrollTopFor, type FocusAnchor } from "@/lib/focus/anchor";
import { readBoxes } from "@/lib/focus/dom";
import type { Block } from "@/lib/blocks/types";
import type { WorkspacePresence } from "@/lib/presence/types";

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
 * The two halves of focus following (UC-030) as they apply to *this* editor:
 * publishing where the presenter is looking, and moving the view to where the
 * followed presenter is looking.
 *
 * Lifted out of `editor.tsx` unchanged. It belongs apart because it reads
 * nothing the rest of that component owns — a container, a document id and a
 * "have the blocks loaded" flag go in, and nothing comes out. The decisions it
 * makes are already pure and tested in `lib/focus/`; only the two effects that
 * drive them lived in the component.
 *
 * Cross-document following — bringing a follower who is looking at a different
 * document — is `focus-follow-provider.tsx`'s job, not this one's: it has to
 * work when no editor is mounted at all.
 */
export function useFocusPresence({
  documentId,
  containerRef,
  blocksLoaded,
  blocks,
  members,
  followingId,
  isPresenting,
  setPresenting,
}: {
  documentId: string;
  containerRef: RefObject<HTMLDivElement | null>;
  /** Flips once, rather than changing on every recompute — see the presenter
   *  effect's own note on why `blocks` itself must not be a dependency. */
  blocksLoaded: boolean;
  /** A dependency of the follower effect only: a third person inserting blocks
   *  above the presenter moves every box without the anchor changing. */
  blocks: Array<Block> | null;
  members: Array<WorkspacePresence>;
  followingId: string | null;
  isPresenting: boolean;
  setPresenting: (anchor: { documentId: string; blockId: string; ratio: number } | null) => void;
}) {
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

    const container = containerRef.current;
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
  }, [isPresenting, documentId, setPresenting, blocksLoaded, containerRef]);

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

    const container = containerRef.current;
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
    containerRef,
  ]);
}
