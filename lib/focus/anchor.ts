import type { BlockId } from "@/lib/blocks/types";

/**
 * One block's vertical extent inside the scroll container's own coordinate
 * space — e.g. `offsetTop`/`offsetHeight` read off the DOM, but this type
 * itself has no DOM dependency so it can be constructed by hand in tests.
 *
 * `boxes` arrays passed to the functions below are assumed ordered
 * top-to-bottom by `top` — the same order the blocks render in — but not
 * assumed contiguous: a margin can leave a gap between one block's
 * `top + height` and the next block's `top`.
 */
export type BlockBox = {
  id: BlockId;
  top: number;
  height: number;
};

/**
 * What travels between presenter and follower: the block whose range
 * contains the viewport's top edge, and how far into that block. A block id
 * plus a fraction, not a pixel — see
 * `tasks/active/20260901-focus-following-todo.md`, "The decision: what
 * travels is an anchor, not a scroll position", for why a raw `scrollTop`
 * is not a shared coordinate between two browsers.
 */
export type FocusAnchor = {
  blockId: BlockId;
  /** 0 at the block's own top, approaching 1 at its bottom. */
  ratio: number;
};

// ponytail: quantized to 1% of the block's height on the way out, so that
// the presenter's "has the anchor actually moved?" check in `editor.tsx` can
// ever match — against a raw float it never did, since a fraction changes on
// every scrolled pixel. This bounds nothing on its own: a scroll crosses
// whole short blocks in a frame or two, so the cadence is `PUBLISH_MS`'s job,
// not this. 1% of a block is far below what a follower can see; drop the
// rounding if a block ever gets tall enough for 1% to read as a jump.
const clampRatio = (ratio: number): number =>
  Math.round(Math.min(Math.max(ratio, 0), 1) * 100) / 100;

/**
 * Finds the block the viewport's top edge sits in, as a `{ blockId, ratio }`
 * pair.
 *
 * One pass down `boxes`, in render order, is enough for every case the task
 * doc calls out: `scrollTop` before a box's own `top` is *always* either
 * before the very first box, or past the previous box's bottom (nothing
 * else can be true, since we would have returned already if `scrollTop`
 * were still inside an earlier box) — so both "before the first block" and
 * "in a gap" collapse into the same branch, and both resolve to the block
 * below with `ratio: 0`. That is the decided behavior for a gap: the
 * reader's eye is moving down the page, so rounding up would show content
 * the presenter has already passed.
 */
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
 * The inverse of `anchorAt`: where to scroll to show a given anchor.
 *
 * Returns `null` when `anchor.blockId` is not in `boxes` — the block was
 * deleted while the presenter was on it, or moved out for any other reason.
 * The caller's contract for `null` is to hold the current scroll position
 * rather than jump anywhere, since there is no longer a target to jump to.
 */
export function scrollTopFor(
  boxes: Array<BlockBox>,
  anchor: FocusAnchor,
): number | null {
  const box = boxes.find((b) => b.id === anchor.blockId);
  if (!box) return null;

  return box.top + anchor.ratio * box.height;
}
