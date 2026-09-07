import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { occupantColorsByBlock, OCCUPANCY_TTL_MS, type BlockPresence } from "./occupancy.ts";

const now = 1_000_000;

/** Shaped like one entry of `doc.getOthersPresences()`. */
const other = (presence: BlockPresence) => ({ clientID: "unused", presence });

const alice = (activeBlockId: string | null, updatedAt = now): BlockPresence => ({
  activeBlockId,
  colorTag: "#ef4444",
  updatedAt,
});
const bob = (activeBlockId: string | null, updatedAt = now): BlockPresence => ({
  activeBlockId,
  colorTag: "#3b82f6",
  updatedAt,
});

describe("occupantColorsByBlock", () => {
  it("is empty when nobody else is present", () => {
    assert.deepEqual(occupantColorsByBlock([], now), new Map());
  });

  it("is empty when nobody else is in a block", () => {
    assert.deepEqual(occupantColorsByBlock([other(alice(null))], now), new Map());
  });

  it("maps each occupied block to its occupant's color", () => {
    const result = occupantColorsByBlock(
      [other(alice("block-1")), other(bob("block-2"))],
      now,
    );
    assert.deepEqual(result, new Map([["block-1", "#ef4444"], ["block-2", "#3b82f6"]]));
  });

  it("the first occupant found wins when two claim the same block", () => {
    const result = occupantColorsByBlock(
      [other(alice("block-1")), other(bob("block-1"))],
      now,
    );
    assert.deepEqual(result, new Map([["block-1", "#ef4444"]]));
  });

  it("excludes an entry whose heartbeat is older than the TTL", () => {
    const stale = now - OCCUPANCY_TTL_MS - 1;
    const result = occupantColorsByBlock([other(alice("block-1", stale))], now);
    assert.deepEqual(result, new Map());
  });

  it("keeps an entry right at the edge of the TTL window", () => {
    const justInside = now - OCCUPANCY_TTL_MS;
    const result = occupantColorsByBlock([other(alice("block-1", justInside))], now);
    assert.deepEqual(result, new Map([["block-1", "#ef4444"]]));
  });
});
