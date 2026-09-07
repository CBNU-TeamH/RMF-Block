import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { occupantsByBlock, OCCUPANCY_TTL_MS, type BlockPresence } from "./occupancy.ts";

const now = 1_000_000;

/** Shaped like one entry of `doc.getOthersPresences()`. */
const other = (presence: BlockPresence) => ({ clientID: "unused", presence });

const alice = (activeBlockId: string | null, updatedAt = now): BlockPresence => ({
  activeBlockId,
  colorTag: "#ef4444",
  nickname: "alice",
  updatedAt,
});
const bob = (activeBlockId: string | null, updatedAt = now): BlockPresence => ({
  activeBlockId,
  colorTag: "#3b82f6",
  nickname: "bob",
  updatedAt,
});

describe("occupantsByBlock", () => {
  it("is empty when nobody else is present", () => {
    assert.deepEqual(occupantsByBlock([], now), new Map());
  });

  it("is empty when nobody else is in a block", () => {
    assert.deepEqual(occupantsByBlock([other(alice(null))], now), new Map());
  });

  it("maps each occupied block to its occupant's color and nickname", () => {
    const result = occupantsByBlock([other(alice("block-1")), other(bob("block-2"))], now);
    assert.deepEqual(
      result,
      new Map([
        ["block-1", { colorTag: "#ef4444", nickname: "alice" }],
        ["block-2", { colorTag: "#3b82f6", nickname: "bob" }],
      ]),
    );
  });

  it("the first occupant found wins when two claim the same block", () => {
    const result = occupantsByBlock([other(alice("block-1")), other(bob("block-1"))], now);
    assert.deepEqual(result, new Map([["block-1", { colorTag: "#ef4444", nickname: "alice" }]]));
  });

  it("excludes an entry whose heartbeat is older than the TTL", () => {
    const stale = now - OCCUPANCY_TTL_MS - 1;
    const result = occupantsByBlock([other(alice("block-1", stale))], now);
    assert.deepEqual(result, new Map());
  });

  it("keeps an entry right at the edge of the TTL window", () => {
    const justInside = now - OCCUPANCY_TTL_MS;
    const result = occupantsByBlock([other(alice("block-1", justInside))], now);
    assert.deepEqual(result, new Map([["block-1", { colorTag: "#ef4444", nickname: "alice" }]]));
  });
});
