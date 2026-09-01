import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { anchorAt, scrollTopFor, type BlockBox } from "./anchor.ts";

/** Three ordinary blocks, back to back, no gaps. */
const boxes: Array<BlockBox> = [
  { id: "a", top: 0, height: 100 },
  { id: "b", top: 100, height: 200 },
  { id: "c", top: 300, height: 50 },
];

describe("anchorAt", () => {
  it("lands in the middle of a block", () => {
    const anchor = anchorAt(boxes, 150);
    assert.equal(anchor?.blockId, "b");
    assert.ok(anchor && anchor.ratio > 0 && anchor.ratio < 1);
  });

  it("is ratio 0 exactly at a block's own top", () => {
    assert.deepEqual(anchorAt(boxes, 100), { blockId: "b", ratio: 0 });
  });

  it("stays in a block taller than the viewport rather than snapping ahead", () => {
    const tall: Array<BlockBox> = [{ id: "big", top: 0, height: 5000 }];
    const anchor = anchorAt(tall, 4000);

    assert.equal(anchor?.blockId, "big");
    assert.ok(anchor && Math.abs(anchor.ratio - 0.8) < 1e-9);
  });

  it("snaps to the next block when scrollTop falls in a gap", () => {
    // A margin leaves a gap between "a"'s bottom (100) and "b"'s top (120).
    const gapped: Array<BlockBox> = [
      { id: "a", top: 0, height: 100 },
      { id: "b", top: 120, height: 100 },
    ];

    assert.deepEqual(anchorAt(gapped, 110), { blockId: "b", ratio: 0 });
  });

  it("snaps to the first block when scrollTop is before it starts", () => {
    const indented: Array<BlockBox> = [{ id: "a", top: 20, height: 100 }];

    assert.deepEqual(anchorAt(indented, 0), { blockId: "a", ratio: 0 });
  });

  it("clamps to the last block, ratio 1, once scrollTop passes its end", () => {
    assert.deepEqual(anchorAt(boxes, 1000), { blockId: "c", ratio: 1 });
  });

  it("is null for an empty document", () => {
    assert.equal(anchorAt([], 50), null);
  });
});

describe("scrollTopFor", () => {
  it("round-trips with anchorAt for a normal in-range scrollTop", () => {
    const anchor = anchorAt(boxes, 150);
    assert.ok(anchor);

    assert.ok(Math.abs(scrollTopFor(boxes, anchor)! - 150) < 1e-9);
  });

  it("is null when the anchor's block has been deleted", () => {
    assert.equal(scrollTopFor(boxes, { blockId: "gone", ratio: 0.5 }), null);
  });

  it("is null for an empty document", () => {
    assert.equal(scrollTopFor([], { blockId: "a", ratio: 0 }), null);
  });
});
