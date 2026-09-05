import type { BlockId } from "@/lib/blocks/types";

/** One block's vertical extent in the scroll container's space, DOM-free so
 *  tests build them by hand. Ordered top-to-bottom but **not** contiguous — a
 *  margin leaves a gap between one block's bottom and the next block's top. */
export type BlockBox = {
  id: BlockId;
  top: number;
  height: number;
};

/** What travels between presenter and follower — a block id plus a fraction,
 *  never a pixel. Why: `docs/design/presence-and-focus.md`, "What travels is an
 *  anchor, not a scroll position". */
export type FocusAnchor = {
  blockId: BlockId;
  /** 0 at the block's own top, approaching 1 at its bottom. */
  ratio: number;
};

// simple: quantized to 1% of the block's height, so the presenter's "has it
// moved?" check can ever match — against a raw float it never did. Bounds
// nothing on its own; the cadence is `PUBLISH_MS`'s job.
const clampRatio = (ratio: number): number =>
  Math.round(Math.min(Math.max(ratio, 0), 1) * 100) / 100;

/** The block the viewport's top edge sits in. One pass suffices: a `scrollTop`
 *  before a box's `top` means "before the first" or "in a gap", and both resolve
 *  to the block *below* at `ratio: 0` — rounding up would show content the
 *  presenter has already scrolled past. */
export function anchorAt(
  boxes: Array<BlockBox>,
  scrollTop: number,
): FocusAnchor | null {
  if (boxes.length === 0) return null;

  for (const box of boxes) {
    if (scrollTop < box.top) {
      return { blockId: box.id, ratio: 0 };
    }

    const bottom = box.top + box.height;
    if (scrollTop < bottom) {
      // Defensive against height 0 — a divider block, say — which would
      // otherwise divide by zero and hand back NaN.
      const ratio = box.height > 0 ? (scrollTop - box.top) / box.height : 0;
      return { blockId: box.id, ratio: clampRatio(ratio) };
    }
  }

  // Ran off the end: scrollTop is at or past the last block's bottom.
  const last = boxes[boxes.length - 1];
  return { blockId: last.id, ratio: 1 };
}

/**
 * The inverse of `anchorAt`. `null` means the anchor's block is gone, and the
 * caller's contract is to hold position rather than jump anywhere.
 */
export function scrollTopFor(
  boxes: Array<BlockBox>,
  anchor: FocusAnchor,
): number | null {
  const box = boxes.find((b) => b.id === anchor.blockId);
  if (!box) return null;

  return box.top + anchor.ratio * box.height;
}
