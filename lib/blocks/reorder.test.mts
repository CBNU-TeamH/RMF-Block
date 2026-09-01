import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  dropDestination,
  dropsBeforeTarget,
  idAfterInOrder,
  idBeforeInOrder,
} from "./reorder.ts";

describe("idBeforeInOrder", () => {
  it("returns the previous id", () => {
    assert.equal(idBeforeInOrder(["a", "b", "c"], "b"), "a");
  });

  it("returns the id before the last one", () => {
    assert.equal(idBeforeInOrder(["a", "b", "c"], "c"), "b");
  });

  it("returns null for the first id", () => {
    assert.equal(idBeforeInOrder(["a", "b"], "a"), null);
  });

  it("returns null for a single-element list", () => {
    assert.equal(idBeforeInOrder(["a"], "a"), null);
  });

  it("returns null for an id not in the list", () => {
    assert.equal(idBeforeInOrder(["a", "b"], "z"), null);
  });

  it("returns null for an empty list", () => {
    assert.equal(idBeforeInOrder([], "a"), null);
  });
});

describe("idAfterInOrder", () => {
  it("returns the next id", () => {
    assert.equal(idAfterInOrder(["a", "b", "c"], "b"), "c");
  });

  it("returns the id after the first one", () => {
    assert.equal(idAfterInOrder(["a", "b", "c"], "a"), "b");
  });

  it("returns null for the last id", () => {
    assert.equal(idAfterInOrder(["a", "b"], "b"), null);
  });

  it("returns null for a single-element list", () => {
    assert.equal(idAfterInOrder(["a"], "a"), null);
  });

  it("returns null for an id not in the list", () => {
    assert.equal(idAfterInOrder(["a", "b"], "z"), null);
  });

  it("returns null for an empty list", () => {
    assert.equal(idAfterInOrder([], "a"), null);
  });
});

describe("dropsBeforeTarget", () => {
  it("returns true above the midpoint", () => {
    assert.equal(dropsBeforeTarget(100, 100, 40), true);
  });

  it("returns false exactly at the midpoint", () => {
    assert.equal(dropsBeforeTarget(120, 100, 40), false);
  });

  it("returns false below the midpoint", () => {
    assert.equal(dropsBeforeTarget(130, 100, 40), false);
  });
});

describe("dropDestination", () => {
  const order = ["a", "b", "c", "d"];

  it("resolves a drop above a block to the id before it", () => {
    assert.deepEqual(dropDestination(order, "d", "b", true), { afterId: "a" });
  });

  it("resolves a drop below a block to that block", () => {
    assert.deepEqual(dropDestination(order, "a", "c", false), { afterId: "c" });
  });

  it("resolves a drop above the first block to the front of the list", () => {
    assert.deepEqual(dropDestination(order, "c", "a", true), { afterId: null });
  });

  it("is null for a block dropped onto itself", () => {
    assert.equal(dropDestination(order, "b", "b", true), null);
    assert.equal(dropDestination(order, "b", "b", false), null);
  });

  it("is null for a drop just below the block already above it", () => {
    assert.equal(dropDestination(order, "c", "b", false), null);
  });

  it("is null for a drop just above the block already below it", () => {
    assert.equal(dropDestination(order, "c", "d", true), null);
  });
});
