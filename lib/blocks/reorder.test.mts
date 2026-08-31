import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { idBeforeInOrder } from "./reorder.ts";

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
