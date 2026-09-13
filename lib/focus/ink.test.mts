import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { anchorAt } from "./anchor.ts";
import {
  capMarks,
  extendMark,
  inkPixelsFor,
  inkPointAt,
  markPixelSegments,
  pointsEqual,
  pruneTrail,
  MARK_CAP,
  MAX_POINTS_PER_MARK,
  MAX_SEGMENTS_PER_MARK,
  MIN_POINT_DISTANCE_PX,
  TRAIL_MS,
  shouldAcceptPoint,
  startMark,
  trailStrokes,
  TRAIL_HEAD_WIDTH_PX,
  TRAIL_TAIL_WIDTH_PX,
  type InkBox,
  type Mark,
  type TrailPoint,
} from "./ink.ts";

/** Three ordinary blocks, back to back. `left: 16` is the scroll container's
 *  own `pl-4`, which is exactly what a point's `x` must not be measured from. */
const boxes: Array<InkBox> = [
  { id: "a", top: 0, height: 100, left: 16, width: 200 },
  { id: "b", top: 100, height: 200, left: 16, width: 200 },
  { id: "c", top: 300, height: 50, left: 16, width: 200 },
];

describe("inkPointAt", () => {
  it("anchors to the block the y lands in", () => {
    const point = inkPointAt(boxes, 116, 200);

    assert.equal(point?.blockId, "b");
    assert.ok(point && point.ratio > 0 && point.ratio < 1);
  });

  it("measures x from the block's own left edge, not the container's", () => {
    // 116 is one half-block-width past `left`, so half way across "b" — not
    // 116/200 of it, which is what measuring from the container would give.
    assert.equal(inkPointAt(boxes, 116, 200)?.x, 0.5);
  });

  it("clamps x when the drag leaves the block sideways", () => {
    assert.equal(inkPointAt(boxes, 0, 200)?.x, 0);
    assert.equal(inkPointAt(boxes, 9999, 200)?.x, 1);
  });

  it("keeps anchorAt's gap rule — a point between blocks takes the one below", () => {
    const gapped: Array<InkBox> = [
      { id: "a", top: 0, height: 100, left: 0, width: 100 },
      { id: "b", top: 120, height: 100, left: 0, width: 100 },
    ];

    const point = inkPointAt(gapped, 50, 110);
    assert.equal(point?.blockId, "b");
    assert.equal(point?.ratio, 0);
  });

  it("keeps anchorAt's past-the-end rule", () => {
    assert.equal(inkPointAt(boxes, 50, 9999)?.ratio, 1);
  });

  it("is null for an empty document", () => {
    assert.equal(inkPointAt([], 10, 10), null);
  });

  it("resolves finer than the scroll anchor, which is left alone", () => {
    // 0.05% into a 600px block: below `anchorAt`'s 1% default, above ink's own
    // step. The pair is the whole point — ink gained precision, the scroll
    // anchor did not lose its coarseness.
    const tall: Array<InkBox> = [{ id: "t", top: 0, height: 600, left: 0, width: 100 }];

    assert.equal(anchorAt(tall, 3)?.ratio, 0.01);
    assert.equal(inkPointAt(tall, 0, 3)?.ratio, 0.005);
  });
});

describe("inkPixelsFor", () => {
  it("round-trips with inkPointAt", () => {
    const point = inkPointAt(boxes, 116, 200);
    assert.ok(point);

    const pixels = inkPixelsFor(boxes, point);
    // Within one quantization step of the block's own height and width.
    assert.ok(pixels && Math.abs(pixels.y - 200) <= 200 / 10_000);
    assert.ok(pixels && Math.abs(pixels.x - 116) <= 200 / 10_000);
  });

  it("is null once the point's block is gone", () => {
    assert.equal(inkPixelsFor(boxes, { blockId: "gone", ratio: 0.5, x: 0.5 }), null);
  });
});

describe("shouldAcceptPoint", () => {
  it("always accepts the first point", () => {
    assert.equal(shouldAcceptPoint(null, { x: 0, y: 0 }), true);
  });

  it("accepts exactly at the threshold distance", () => {
    assert.equal(
      shouldAcceptPoint({ x: 0, y: 0 }, { x: MIN_POINT_DISTANCE_PX, y: 0 }),
      true,
    );
  });

  it("rejects just under the threshold", () => {
    assert.equal(shouldAcceptPoint({ x: 0, y: 0 }, { x: 1, y: 1 }), false);
  });

  it("accepts a point well past the threshold", () => {
    assert.equal(shouldAcceptPoint({ x: 0, y: 0 }, { x: 100, y: 100 }), true);
  });
});

describe("startMark", () => {
  it("makes one segment with one point", () => {
    const mark = startMark("underline", { blockId: "a", ratio: 0.2, x: 0.3 });

    assert.deepEqual(mark, {
      kind: "underline",
      segments: [{ blockId: "a", points: [{ ratio: 0.2, x: 0.3 }] }],
    });
  });
});

/** `extendMark`'s own point-count check is internal; sum it back up here
 *  rather than exporting a second entry point just for tests. */
const pointCountOf = (mark: Mark): number =>
  mark.segments.reduce((sum, segment) => sum + segment.points.length, 0);

describe("extendMark", () => {
  it("appends to the last segment when the block is unchanged", () => {
    const mark = startMark("underline", { blockId: "a", ratio: 0, x: 0 });
    const extended = extendMark(mark, { blockId: "a", ratio: 0.1, x: 0.1 });

    assert.equal(extended.segments.length, 1);
    assert.equal(extended.segments[0].points.length, 2);
  });

  it("starts a new segment when the point crosses into another block", () => {
    const mark = startMark("underline", { blockId: "a", ratio: 0.9, x: 0.5 });
    const extended = extendMark(mark, { blockId: "b", ratio: 0, x: 0.5 });

    assert.equal(extended.segments.length, 2);
    assert.equal(extended.segments[1].blockId, "b");
  });

  it("stops growing at exactly MAX_POINTS_PER_MARK", () => {
    let mark = startMark("underline", { blockId: "a", ratio: 0, x: 0 });
    for (let i = 1; i < MAX_POINTS_PER_MARK; i += 1) {
      mark = extendMark(mark, { blockId: "a", ratio: i / MAX_POINTS_PER_MARK, x: 0 });
    }
    assert.equal(mark.segments[0].points.length, MAX_POINTS_PER_MARK);

    const atCap = extendMark(mark, { blockId: "a", ratio: 1, x: 0 });
    assert.equal(atCap.segments[0].points.length, MAX_POINTS_PER_MARK);
  });

  it("stops growing at exactly MAX_SEGMENTS_PER_MARK when every point crosses a block", () => {
    // The adversarial case MAX_SEGMENTS_PER_MARK exists for: alternating
    // blocks, one point apiece, well short of MAX_POINTS_PER_MARK.
    let mark = startMark("underline", { blockId: "a", ratio: 0, x: 0 });
    for (let i = 1; i < MAX_SEGMENTS_PER_MARK; i += 1) {
      mark = extendMark(mark, { blockId: i % 2 === 0 ? "a" : "b", ratio: 0, x: 0 });
    }
    assert.equal(mark.segments.length, MAX_SEGMENTS_PER_MARK);
    assert.equal(pointCountOf(mark), MAX_SEGMENTS_PER_MARK);

    const atCap = extendMark(mark, { blockId: "c", ratio: 0, x: 0 });
    assert.equal(atCap.segments.length, MAX_SEGMENTS_PER_MARK);
    assert.equal(pointCountOf(atCap), MAX_SEGMENTS_PER_MARK);
  });

  it("a same-block extension past MAX_SEGMENTS_PER_MARK still grows the last segment", () => {
    // The segment cap only blocks *starting a new one* — a mark already at
    // the cap can still accept more points in whichever block it's in.
    let mark = startMark("underline", { blockId: "a", ratio: 0, x: 0 });
    for (let i = 1; i < MAX_SEGMENTS_PER_MARK; i += 1) {
      mark = extendMark(mark, { blockId: i % 2 === 0 ? "a" : "b", ratio: 0, x: 0 });
    }
    const lastBlock = mark.segments[mark.segments.length - 1].blockId;

    const extended = extendMark(mark, { blockId: lastBlock, ratio: 0.5, x: 0 });
    assert.equal(extended.segments.length, MAX_SEGMENTS_PER_MARK);
    assert.equal(pointCountOf(extended), MAX_SEGMENTS_PER_MARK + 1);
  });
});

describe("markPixelSegments", () => {
  it("round-trips a single-segment mark through inkPixelsFor", () => {
    const mark = startMark("underline", { blockId: "b", ratio: 0.5, x: 0.5 });
    const segments = markPixelSegments(boxes, mark);

    assert.equal(segments.length, 1);
    assert.deepEqual(segments[0], [{ x: 116, y: 200 }]);
  });

  /** Replaces a test that asserted the opposite ("two separate point arrays").
   *  The hand did not lift at the block boundary, so the drawn path must not
   *  either — one run per segment left no line between one segment's last
   *  point and the next one's first, and a circle drawn over two blocks came
   *  out cut at the two places it crosses the seam. */
  it("joins a stroke that crosses a block boundary into one unbroken run", () => {
    const mark: Mark = {
      kind: "highlight",
      segments: [
        { blockId: "a", points: [{ ratio: 0.5, x: 0.5 }] },
        { blockId: "b", points: [{ ratio: 0, x: 0.5 }] },
      ],
    };

    const runs = markPixelSegments(boxes, mark);

    assert.equal(runs.length, 1);
    assert.deepEqual(runs[0], [
      { x: 116, y: 50 },
      { x: 116, y: 100 },
    ]);
  });

  /** A single-point segment used to render as a one-vertex `<polyline>`, which
   *  draws nothing — so a fast crossing lost its corner entirely on top of the
   *  gap. Folded into the run, the corner is just another vertex. */
  it("keeps a one-point crossing as a vertex rather than dropping it", () => {
    const mark: Mark = {
      kind: "underline",
      segments: [
        { blockId: "a", points: [{ ratio: 0.2, x: 0.1 }] },
        { blockId: "b", points: [{ ratio: 0.5, x: 0.5 }] },
        { blockId: "c", points: [{ ratio: 0.5, x: 0.9 }] },
      ],
    };

    const runs = markPixelSegments(boxes, mark);

    assert.equal(runs.length, 1);
    assert.equal(runs[0].length, 3);
  });

  /** The break the per-segment split was actually protecting, and the one case
   *  that must survive the join: joining across a deleted block would draw a
   *  straight line through where it used to be. */
  it("still breaks the run where a block in the middle is gone", () => {
    const mark: Mark = {
      kind: "underline",
      segments: [
        { blockId: "a", points: [{ ratio: 0.5, x: 0.5 }] },
        { blockId: "gone", points: [{ ratio: 0.5, x: 0.5 }] },
        { blockId: "c", points: [{ ratio: 0.5, x: 0.5 }] },
      ],
    };

    assert.equal(markPixelSegments(boxes, mark).length, 2);
  });

  it("drops a segment whose block has been deleted", () => {
    const mark: Mark = { kind: "underline", segments: [{ blockId: "gone", points: [{ ratio: 0, x: 0 }] }] };

    assert.deepEqual(markPixelSegments(boxes, mark), []);
  });
});

describe("capMarks", () => {
  const mark = (id: string): Mark => ({
    kind: "underline",
    segments: [{ blockId: id, points: [{ ratio: 0, x: 0 }] }],
  });
  const upTo = (count: number) =>
    Array.from({ length: count }, (_unused, index) => mark(`m${index}`));

  it("grows to exactly the cap without dropping anything", () => {
    const capped = capMarks(upTo(MARK_CAP));

    assert.equal(capped.length, MARK_CAP);
    assert.equal(capped[0].segments[0].blockId, "m0");
  });

  it("drops the oldest at one past the cap", () => {
    const capped = capMarks(upTo(MARK_CAP + 1));

    assert.equal(capped.length, MARK_CAP);
    assert.equal(capped[0].segments[0].blockId, "m1");
    assert.equal(capped[MARK_CAP - 1].segments[0].blockId, `m${MARK_CAP}`);
  });
});

describe("the point budget the two caps split between them", () => {
  /** One highlight across a laptop-width editor pane. The scroll container is
   *  `flex-1` with no max-width, so this is an ordinary gesture, not a long
   *  one — and a freehand path spends more than the distance it covers. The
   *  cap that froze mid-stroke allowed 600px. Pinned as a *distance*, not as
   *  the constant itself: a test that reads `MAX_POINTS_PER_MARK` back can
   *  never fail when someone lowers it. */
  it("lets one stroke cross a full-width pane before it freezes", () => {
    assert.ok(
      MAX_POINTS_PER_MARK * MIN_POINT_DISTANCE_PX >= 1_200,
      `a stroke freezes after ${MAX_POINTS_PER_MARK * MIN_POINT_DISTANCE_PX}px of travel`,
    );
  });

  /** The invariant the trade actually rests on: raising one cap is paid for by
   *  lowering the other, so the worst case a presenter can put on the wire
   *  does not grow. Measured against the real encoding rather than a byte
   *  estimate, at the ceiling both caps allow at once. */
  it("keeps the worst-case presence payload inside its measured budget", () => {
    // Four decimals, because that is what `inkPointAt` stores and the payload
    // is the point of the test — raw floats would serialize ~17 digits each
    // and measure a shape this code never puts on the wire.
    const quantized = (value: number) => Math.round(value * 10_000) / 10_000;

    const full = Array.from({ length: MARK_CAP }, () => {
      let mark = startMark("highlight", { blockId: "a", ratio: 0, x: 0 });
      for (let i = 1; i < MAX_POINTS_PER_MARK; i += 1) {
        const at = quantized(i / MAX_POINTS_PER_MARK);
        mark = extendMark(mark, { blockId: "a", ratio: at, x: at });
      }
      return mark;
    });

    const kb = Buffer.byteLength(JSON.stringify(full)) / 1024;
    assert.ok(kb <= 135, `worst-case marks payload is ${kb.toFixed(1)}KB`);
  });
});

describe("pruneTrail", () => {
  const now = 1_000_000;
  const point = (at: number): TrailPoint => ({ blockId: "a", ratio: 0, x: 0, at });

  it("is empty in, empty out", () => {
    assert.deepEqual(pruneTrail([], now), []);
  });

  it("keeps a mix and drops only the old ones", () => {
    const trail = [point(now - TRAIL_MS - 1), point(now - 100), point(now)];
    const pruned = pruneTrail(trail, now);

    assert.deepEqual(pruned, [point(now - 100), point(now)]);
  });

  it("drops a point aged exactly TRAIL_MS", () => {
    const trail = [point(now - TRAIL_MS)];
    assert.deepEqual(pruneTrail(trail, now), []);
  });

  it("keeps a point aged TRAIL_MS - 1", () => {
    const trail = [point(now - (TRAIL_MS - 1))];
    assert.deepEqual(pruneTrail(trail, now), trail);
  });

  it("returns the same array reference when nothing is dropped", () => {
    const trail = [point(now)];
    assert.equal(pruneTrail(trail, now), trail);
  });
});

describe("pointsEqual", () => {
  it("is true for two nulls", () => {
    assert.equal(pointsEqual(null, null), true);
  });

  it("is false when only one side is null", () => {
    const point = { blockId: "a", ratio: 0.5, x: 0.5 };
    assert.equal(pointsEqual(null, point), false);
    assert.equal(pointsEqual(point, null), false);
  });

  it("is true for the same anchor from two separate reads", () => {
    // A heartbeat re-send is a fresh object, not the same reference — the
    // whole point of this function is comparing by value.
    assert.equal(
      pointsEqual({ blockId: "a", ratio: 0.5, x: 0.5 }, { blockId: "a", ratio: 0.5, x: 0.5 }),
      true,
    );
  });

  it("is false when any single field differs", () => {
    const base = { blockId: "a", ratio: 0.5, x: 0.5 };
    assert.equal(pointsEqual(base, { ...base, blockId: "b" }), false);
    assert.equal(pointsEqual(base, { ...base, ratio: 0.6 }), false);
    assert.equal(pointsEqual(base, { ...base, x: 0.6 }), false);
  });
});

describe("trailStrokes", () => {
  const at = 10_000;
  /** Four positions down one block, as `PUBLISH_MS` apart as they arrive. */
  const trail = [0, 100, 200, 300].map((offset, index) => ({
    blockId: "b",
    ratio: 0.1 + index * 0.1,
    x: 0.5,
    at: at + offset,
  }));

  it("draws nothing until there are two points to join", () => {
    assert.deepEqual(trailStrokes(boxes, [], at), []);
    assert.deepEqual(trailStrokes(boxes, trail.slice(0, 1), at), []);
  });

  /** The stutter was gaps, not opacity: one circle per received point leaves
   *  the distance a hand covers in `PUBLISH_MS` undrawn between each pair.
   *  Every piece has to start where the previous one ended for the trail to
   *  read as one continuous mark. */
  it("joins its pieces end to end, leaving no gap between samples", () => {
    const strokes = trailStrokes(boxes, trail, trail[trail.length - 1].at);

    assert.equal(strokes.length, trail.length - 1);
    for (let i = 1; i < strokes.length; i += 1) {
      const previousEnd = strokes[i - 1].d.split(" ").at(-1);
      const currentStart = strokes[i].d.split(" ")[0].slice(1);
      assert.equal(currentStart, previousEnd, `piece ${i} does not start where ${i - 1} ended`);
    }
  });

  /** A laser pointer tapers. The oldest piece must be both thinner and fainter
   *  than the newest, or the trail reads as a train of equal dots. */
  it("tapers and fades from the head back along the trail", () => {
    const strokes = trailStrokes(boxes, trail, trail[trail.length - 1].at);
    const [oldest] = strokes;
    const newest = strokes[strokes.length - 1];

    assert.ok(newest.width > oldest.width);
    assert.ok(newest.opacity > oldest.opacity);
    assert.ok(newest.width <= TRAIL_HEAD_WIDTH_PX);
    assert.ok(oldest.width >= TRAIL_TAIL_WIDTH_PX);
  });

  /** Both ends clamped: `now` can trail an arrival by a frame, and a point can
   *  be fractionally past `TRAIL_MS` before the prune that drops it lands. */
  it("clamps life at both ends rather than going negative or past full", () => {
    const stale = trailStrokes(boxes, trail, at + TRAIL_MS * 5);
    for (const stroke of stale) {
      assert.equal(stroke.opacity, 0);
      assert.equal(stroke.width, TRAIL_TAIL_WIDTH_PX);
    }

    const early = trailStrokes(boxes, trail, at - 50);
    for (const stroke of early) {
      assert.ok(stroke.opacity <= 1);
      assert.equal(stroke.width, TRAIL_HEAD_WIDTH_PX);
    }
  });

  it("drops a point whose block is gone rather than drawing to nowhere", () => {
    const orphaned = [{ blockId: "gone", ratio: 0.5, x: 0.5, at }, ...trail];

    assert.equal(trailStrokes(boxes, orphaned, at).length, trail.length - 1);
  });
});
