import { useEffect, useRef, type RefObject } from "react";

import { anchorAt, scrollTopFor, type FocusAnchor } from "@/lib/focus/anchor";
import { readBoxes } from "@/lib/focus/dom";
import type { Block } from "@/lib/blocks/types";
import type { WorkspacePresence } from "@/lib/presence/types";

/** How often a presenter's anchor may go out, at most.
 *  simple: a plain interval, no easing or adaptive cadence
 *  (`docs/design/presence-and-focus.md`). Lower it if following reads as steppy. */
const PUBLISH_MS = 100;

/** Focus following (UC-030) for *this* editor. The decisions are pure and tested
 *  in `lib/focus/`; only the two effects driving them are here. Crossing to a
 *  different document is `focus-follow-provider.tsx`'s, which works unmounted. */
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
  // The last anchor published, so an unchanged one is not sent again.
  const lastPublishedAnchorRef = useRef<FocusAnchor | null>(null);
  // The last target *commanded* — not `scrollTop`, which reads where the
  // animation is. Why re-issuing breaks following: `presence-and-focus.md`.
  const lastScrolledToRef = useRef<number | null>(null);

  // Primitives, not `members` — `rosterFrom` rebuilds that on every presence
  // event (`presence-and-focus.md`, "What the two focus effects may depend on").
  const followed = followingId
    ? (members.find((m) => m.id === followingId)?.presenting ?? null)
    : null;
  const followedDocumentId = followed?.documentId ?? null;
  const followedBlockId = followed?.blockId ?? null;
  const followedRatio = followed?.ratio ?? null;

  // Presenter side (FR-030-07): publish this scroller's anchor as it moves,
  // throttled to one per `PUBLISH_MS`, trailing edge.
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

    // Wall clock, not `requestAnimationFrame` (`presence-and-focus.md`).
    const onScroll = () => {
      if (timer !== null) return;
      timer = setTimeout(publish, Math.max(0, PUBLISH_MS - (Date.now() - publishedAt)));
    };

    // Once up front, not only on the next scroll (`presence-and-focus.md`).
    onScroll();

    container.addEventListener("scroll", onScroll);
    return () => {
      container.removeEventListener("scroll", onScroll);
      if (timer !== null) clearTimeout(timer);
    };
    // `blocksLoaded`, never `blocks` itself — depending on the array rebuilt
    // this listener continuously and dropped scroll events. See
    // `presence-and-focus.md`, "What the two focus effects may depend on".
  }, [isPresenting, documentId, setPresenting, blocksLoaded, containerRef]);

  // Follower side (FR-030-05/07): scroll to match whenever the followed anchor
  // changes.
  useEffect(() => {
    // Nothing to follow. The last commanded position is forgotten with it
    // (`presence-and-focus.md`).
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

    // A pixel of slack: `top` is a float off live layout and a block's height
    // can wobble by sub-pixels between recomputes.
    const last = lastScrolledToRef.current;
    if (last !== null && Math.abs(top - last) <= 1) {
      return;
    }

    lastScrolledToRef.current = top;
    container.scrollTo({ top, behavior: "smooth" });
    // `blocks` stays a dependency here, unlike the presenter effect above —
    // the asymmetry is argued in `presence-and-focus.md`.
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
