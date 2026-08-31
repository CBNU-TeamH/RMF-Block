import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dropsBeforeTarget, idAfterInOrder, idBeforeInOrder } from "./reorder.ts";

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
