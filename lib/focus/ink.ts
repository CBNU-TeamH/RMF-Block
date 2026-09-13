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
 *  own growth. Past the cap, `extendMark` stops appending: the stroke freezes
 *  rather than losing its start, which would move where it appears to begin.
 *
 *  600 points is ~1,200px of accepted travel at the 2px floor. The previous
 *  300 was justified as ">=600px ... already several paragraph-widths past
 *  what a gesture needs", which held while a mark was a straight band between
 *  two endpoints and stopped holding when it became a freehand path: the
 *  editor's scroll container is `flex-1` with no max-width, so one horizontal
 *  pass across a laptop-width pane is already ~1,000px, and a path that
 *  actually follows the hand spends more than the distance it covers. The
 *  freeze was reachable in a single ordinary highlight, and reported as the
 *  stroke "breaking and starting again".
 *
 *  Paid for out of `MARK_CAP` rather than the wire budget, so the measured
 *  worst case is unchanged: 16 x 300 points = 126.0KB, 8 x 600 = 127.0KB
 *  (measured at this encoding, not estimated). Trading stroke *count* for
 *  stroke *length* is the right way round — the freeze hit every long gesture,
 *  where the 9th uncleared stroke dropping the 1st needs nine of them with
 *  지우기 untouched. */
export const MAX_POINTS_PER_MARK = 600;

/** How many marks a member may hold before the oldest is dropped. Bounds the
 *  *count* of strokes; `MAX_POINTS_PER_MARK` bounds what each one costs, since
 *  a mark is no longer the fixed ~110-byte shape this number was first sized
 *  against — see that constant's own comment for the current worst case, and
 *  for why halving this is what pays for doubling that. */
export const MARK_CAP = 8;

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

/** A mark, decoded to the pixel runs it should be drawn as. Reuses
 *  `inkPixelsFor` per point rather than duplicating its coordinate math.
 *
 *  One run per *unbroken* stretch of the stroke, not one per segment. A mark
 *  is segmented by block so each run can decode against its own box, but the
 *  hand never lifted at those boundaries, so the drawn path must not lift
 *  either: returning a run per segment left no line between one segment's last
 *  point and the next one's first, and a stroke crossing a block boundary came
 *  out visibly cut. Drawing a circle over two blocks broke it at the two points
 *  where it crosses the seam — the quarter points, with the button still held.
 *  A segment that decoded to a single point made it worse: one vertex is a
 *  `<polyline>` that draws nothing at all, so a quick crossing lost its corner
 *  outright.
 *
 *  A segment whose block is gone still breaks the run, which is the case the
 *  per-segment split was protecting: joining across it would draw a straight
 *  line through where that block used to be. That break is deliberate; the one
 *  at every healthy boundary was not. */
export function markPixelSegments(
  boxes: Array<InkBox>,
  mark: Mark,
): Array<Array<{ x: number; y: number }>> {
  const runs: Array<Array<{ x: number; y: number }>> = [];
  let current: Array<{ x: number; y: number }> = [];

  for (const segment of mark.segments) {
    const pixels = segment.points
      .map((point) => inkPixelsFor(boxes, { blockId: segment.blockId, ...point }))
      .filter((pixel): pixel is { x: number; y: number } => pixel !== null);

    if (pixels.length === 0) {
      if (current.length > 0) runs.push(current);
      current = [];
      continue;
    }

    current.push(...pixels);
  }

  if (current.length > 0) runs.push(current);

  return runs;
}

/** Keeps a member's marks inside `MARK_CAP`, oldest first out. */
export function capMarks(marks: Array<Mark>): Array<Mark> {
  return marks.length <= MARK_CAP ? marks : marks.slice(marks.length - MARK_CAP);
}

/** A received pointer position, stamped with *this browser's own* arrival
 *  time — no clock sync between machines, since only the current point is
 *  ever transmitted (never a trail) and each receiver builds its own history
 *  from when it actually saw each one. */
export type TrailPoint = InkPoint & { at: number };

/** Shorter than #95's original "~2-3s" — seen live, that read as lingering
 *  too long after the presenter stopped moving. */
export const TRAIL_MS = 1_500;

/** Drops points older than `TRAIL_MS`. Returns the same array reference when
 *  nothing was dropped, so an idle prune tick doesn't re-render a trail that
 *  hasn't changed. */
export function pruneTrail(trail: Array<TrailPoint>, now: number): Array<TrailPoint> {
  const fresh = trail.filter((point) => now - point.at < TRAIL_MS);
  return fresh.length === trail.length ? trail : fresh;
}
