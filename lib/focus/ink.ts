import type { BlockId } from "@/lib/blocks/types";

import { anchorAt, scrollTopFor, type BlockBox, type FocusAnchor } from "./anchor";

/** A block's extent in both axes. The scroll anchor reads only the vertical
 *  half, which is why `BlockBox` stops there. */
export type InkBox = BlockBox & { left: number; width: number };

/** A point a presenter drew, in the currency the scroll anchor already travels
 *  in — a block plus fractions of it, never a pixel. Why:
 *  `docs/design/presence-and-focus.md`, "What travels is an anchor". */
export type InkPoint = FocusAnchor & { x: number };

export type MarkKind = "underline" | "highlight";

/** A point on a stroke — `InkPoint` minus the block id, which `InkSegment`
 *  already carries once for its whole run. */
export type MarkPoint = Omit<InkPoint, "blockId">;

/** A contiguous run of a stroke that stayed inside one block. A stroke
 *  crossing blocks becomes several of these, each independently decodable
 *  through `inkPixelsFor` — a block can reflow independently of its
 *  neighbors, the same reason presence anchors by block at all. */
export type InkSegment = { blockId: BlockId; points: Array<MarkPoint> };

/** A freehand stroke: one style, an ordered path of segments. Why not a flat
 *  `Array<InkPoint>`: `docs/design/presence-and-focus.md`, "The ink layer". */
export type Mark = { kind: MarkKind; segments: Array<InkSegment> };

// simple: ink quantizes finer than the scroll anchor's 1%, for a different
// reason — not an equality check but the presence payload. Yorkie transmits the
// whole presence on every write (there is no delta), so a short number is the
// only lever. 1/10000 caps a ratio at four decimals and is still under half a
// pixel on a 5000px block, the tallest `anchor.test.mts` measures.
const INK_RATIO_STEPS = 10_000;

/** Precedent: issue #95 cites Yorkie's own cursors example, which thins at
 *  2px — finer than any drag needs to look smooth, coarser than a native
 *  pointermove stream's per-event delta at normal speed. Pixel space, not
 *  ratio space: ratios live in different blocks' own scales and aren't
 *  comparable as a physical distance. */
export const MIN_POINT_DISTANCE_PX = 2;

/** Bounds what `MARK_CAP` no longer can once a mark is an open path: a mark's
 *  own growth. Measured (not estimated) at the segmented encoding above, 300
 *  points is 8,495 serialized bytes — >=600px of accepted travel at the 2px
 *  floor, already several paragraph-widths past what an underline or
 *  highlight gesture needs. Past the cap, `extendMark` stops appending: the
 *  stroke freezes rather than losing its start, which would be more code and
 *  would move where the stroke appears to begin. Worst case, all `MARK_CAP`
 *  marks at this cap: 16 x 8,495B =~ 133KB — up from ~1.8KB when a mark was a
 *  fixed rectangle. Not shrunk further: reaching it needs 16 uncleared
 *  300-point strokes, far outside real use, and it costs bandwidth only while
 *  that state persists, not a recurring per-second cost. */
export const MAX_POINTS_PER_MARK = 300;

/** How many marks a member may hold before the oldest is dropped. Bounds the
 *  *count* of strokes; `MAX_POINTS_PER_MARK` bounds what each one costs, since
 *  a mark is no longer the fixed ~110-byte shape this number was first sized
 *  against — see that constant's own comment for the current worst case. */
export const MARK_CAP = 16;

const fraction = (value: number, extent: number): number => {
  if (extent <= 0) return 0;
  const ratio = Math.min(Math.max(value / extent, 0), 1);

  return Math.round(ratio * INK_RATIO_STEPS) / INK_RATIO_STEPS;
};

/** A pixel in the scroll container's space → an anchored point. The vertical
 *  half is `anchorAt`'s: the gap, before-the-first and past-the-last rules stay
 *  its, rather than being restated with a chance to disagree. */
export function inkPointAt(
  boxes: Array<InkBox>,
  px: number,
  py: number,
): InkPoint | null {
  const anchor = anchorAt(boxes, py, INK_RATIO_STEPS);
  if (!anchor) return null;

  const box = boxes.find((candidate) => candidate.id === anchor.blockId);
  if (!box) return null;

  return { ...anchor, x: fraction(px - box.left, box.width) };
}

/** The inverse. `null` means the point's block is gone, and the caller's
 *  contract is to drop it rather than draw somewhere arbitrary. */
export function inkPixelsFor(
  boxes: Array<InkBox>,
  point: InkPoint,
): { x: number; y: number } | null {
  const box = boxes.find((candidate) => candidate.id === point.blockId);
  const y = scrollTopFor(boxes, point);
  if (!box || y === null) return null;

  return { x: box.left + point.x * box.width, y };
}

/** Whether a candidate point is far enough from the last *accepted* one to be
 *  worth keeping — squared distance, no `sqrt` needed. `null` (nothing
 *  accepted yet) always accepts. */
export function shouldAcceptPoint(
  last: { x: number; y: number } | null,
  candidate: { x: number; y: number },
): boolean {
  if (!last) return true;

  const dx = candidate.x - last.x;
  const dy = candidate.y - last.y;

  return dx * dx + dy * dy >= MIN_POINT_DISTANCE_PX * MIN_POINT_DISTANCE_PX;
}

/** A new stroke, one segment, one point. */
export function startMark(kind: MarkKind, point: InkPoint): Mark {
  return {
    kind,
    segments: [{ blockId: point.blockId, points: [{ ratio: point.ratio, x: point.x }] }],
  };
}

function pointCount(mark: Mark): number {
  return mark.segments.reduce((sum, segment) => sum + segment.points.length, 0);
}

/** Appends to the last segment when the point landed in the same block, or
 *  starts a new one when it didn't — a block can reflow independently of its
 *  neighbors, so each run has to decode against its own boxes later. A no-op
 *  once `MAX_POINTS_PER_MARK` is reached. */
export function extendMark(mark: Mark, point: InkPoint): Mark {
  if (pointCount(mark) >= MAX_POINTS_PER_MARK) return mark;

  const segments = mark.segments;
  const last = segments[segments.length - 1];
  const next: MarkPoint = { ratio: point.ratio, x: point.x };

  if (last.blockId === point.blockId) {
    return {
      ...mark,
      segments: [...segments.slice(0, -1), { blockId: last.blockId, points: [...last.points, next] }],
    };
  }

  return { ...mark, segments: [...segments, { blockId: point.blockId, points: [next] }] };
}

/** A mark, decoded to one array of pixels per segment — one polyline per
 *  contiguous same-block run. Reuses `inkPixelsFor` per point rather than
 *  duplicating its coordinate math. A segment whose block is gone decodes to
 *  no points and is dropped, rather than drawing a broken line through it. */
export function markPixelSegments(
  boxes: Array<InkBox>,
  mark: Mark,
): Array<Array<{ x: number; y: number }>> {
  return mark.segments
    .map((segment) =>
      segment.points
        .map((point) => inkPixelsFor(boxes, { blockId: segment.blockId, ...point }))
        .filter((pixel): pixel is { x: number; y: number } => pixel !== null),
    )
    .filter((points) => points.length > 0);
}

/** Keeps a member's marks inside `MARK_CAP`, oldest first out. */
export function capMarks(marks: Array<Mark>): Array<Mark> {
  return marks.length <= MARK_CAP ? marks : marks.slice(marks.length - MARK_CAP);
}
