import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { anchorAt } from "./anchor.ts";
import {
  capMarks,
  extendMark,
  inkPixelsFor,
  inkPointAt,
  markPixelSegments,
  MARK_CAP,
  MAX_POINTS_PER_MARK,
  MIN_POINT_DISTANCE_PX,
  shouldAcceptPoint,
  startMark,
  type InkBox,
  type Mark,
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
});

describe("markPixelSegments", () => {
  it("round-trips a single-segment mark through inkPixelsFor", () => {
    const mark = startMark("underline", { blockId: "b", ratio: 0.5, x: 0.5 });
    const segments = markPixelSegments(boxes, mark);

    assert.equal(segments.length, 1);
    assert.deepEqual(segments[0], [{ x: 116, y: 200 }]);
  });

  it("keeps a two-block stroke as two separate point arrays", () => {
    const mark: Mark = {
      kind: "highlight",
      segments: [
        { blockId: "a", points: [{ ratio: 0.5, x: 0.5 }] },
        { blockId: "b", points: [{ ratio: 0, x: 0.5 }] },
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
