import assert from "node:assert/strict";
import { describe, it } from "vitest";

import type { Mark } from "../focus/ink.ts";

import { inkFrom, occupantsByBlock, sameOccupants, OCCUPANCY_TTL_MS, type BlockPresence } from "./occupancy.ts";

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

describe("inkFrom", () => {
  const mark: Mark = {
    kind: "underline",
    segments: [{ blockId: "block-1", points: [{ ratio: 0.2, x: 0 }, { ratio: 0.3, x: 1 }] }],
  };
  const drawing = (id: string, presence: BlockPresence): BlockPresence => ({
    ...presence,
    id,
    marks: [mark],
  });

  it("is null for someone following nobody — a non-follower sees nothing", () => {
    assert.equal(inkFrom([other(drawing("alice", alice("block-1")))], null), null);
  });

  it("is null when nobody present is the followed member", () => {
    assert.equal(inkFrom([other(drawing("alice", alice("block-1")))], "carol"), null);
  });

  it("returns only the followed member's marks when two people have drawn", () => {
    const others = [other(drawing("alice", alice(null))), other(drawing("bob", bob(null)))];

    assert.deepEqual(inkFrom(others, "bob"), { marks: [mark], colorTag: "#3b82f6" });
  });

  it("treats a member who has never drawn as having no marks", () => {
    const never: BlockPresence = { ...alice("block-1"), id: "alice" };

    assert.deepEqual(inkFrom([other(never)], "alice"), { marks: [], colorTag: "#ef4444" });
  });

  it("skips an entry with no id at all rather than throwing", () => {
    assert.equal(inkFrom([other(alice("block-1"))], "alice"), null);
  });
});

describe("sameOccupants", () => {
  it("is true for two empty maps", () => {
    assert.equal(sameOccupants(new Map(), new Map()), true);
  });

  it("is true when every block's occupant matches", () => {
    const a = new Map([["block-1", { colorTag: "#ef4444", nickname: "alice" }]]);
    const b = new Map([["block-1", { colorTag: "#ef4444", nickname: "alice" }]]);
    assert.equal(sameOccupants(a, b), true);
  });

  it("is false when the sizes differ", () => {
    const a = new Map([["block-1", { colorTag: "#ef4444", nickname: "alice" }]]);
    assert.equal(sameOccupants(a, new Map()), false);
  });

  it("is false when the same block's occupant changed", () => {
    const a = new Map([["block-1", { colorTag: "#ef4444", nickname: "alice" }]]);
    const b = new Map([["block-1", { colorTag: "#3b82f6", nickname: "bob" }]]);
    assert.equal(sameOccupants(a, b), false);
  });
});
