import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { indentedDepth, preservingDepth } from "./indent.ts";
import { MAX_LIST_DEPTH, type Block } from "./types.ts";

const text = (id: string): Block => ({ id, type: "text", text: "" });
const item = (id: string, depth = 0): Block => ({
  id,
  type: "list",
  style: "unordered",
  depth,
  text: "",
});

describe("indentedDepth — indenting", () => {
  it("indents an item that has a list above it", () => {
    assert.equal(indentedDepth([item("a"), item("b")], "b", "in"), 1);
  });

  it("refuses the first item in a run — it has nothing to nest under", () => {
    assert.equal(indentedDepth([item("a"), item("b")], "a", "in"), null);
  });

  it("refuses an item whose predecessor is not a list", () => {
    assert.equal(indentedDepth([text("a"), item("b")], "b", "in"), null);
  });

  it("allows one level deeper than the block above, never two", () => {
    // a=0, b=1: c may reach 2 …
    assert.equal(indentedDepth([item("a", 0), item("b", 1), item("c", 0)], "c", "in"), 1);
    assert.equal(indentedDepth([item("a", 0), item("b", 1), item("c", 1)], "c", "in"), 2);
    // … but not 3, which would be a child of nothing.
    assert.equal(indentedDepth([item("a", 0), item("b", 1), item("c", 2)], "c", "in"), null);
  });

  it("stops at MAX_LIST_DEPTH even when the block above allows more", () => {
    const deep = [item("a", MAX_LIST_DEPTH), item("b", MAX_LIST_DEPTH)];
    assert.equal(indentedDepth(deep, "b", "in"), null);
  });

  it("reaches MAX_LIST_DEPTH exactly", () => {
    const blocks = [item("a", MAX_LIST_DEPTH - 1), item("b", MAX_LIST_DEPTH - 1)];
    assert.equal(indentedDepth(blocks, "b", "in"), MAX_LIST_DEPTH);
  });
});

describe("indentedDepth — outdenting", () => {
  it("outdents a nested item", () => {
    assert.equal(indentedDepth([item("a"), item("b", 2)], "b", "out"), 1);
  });

  it("floors at 0", () => {
    assert.equal(indentedDepth([item("a"), item("b", 0)], "b", "out"), null);
  });

  it("outdents the first item in a run, which indent refuses", () => {
    // Outdent has no predecessor rule: a stray nested item must always be able
    // to come back out, however it got there.
    assert.equal(indentedDepth([item("a", 2)], "a", "out"), 1);
  });
});

describe("indentedDepth — blocks that do not nest", () => {
  it("returns null for a text block", () => {
    assert.equal(indentedDepth([item("a"), text("b")], "b", "in"), null);
  });

  it("returns null for a checklist — SRS §4.1 gives nesting to 목록 only", () => {
    const blocks: Array<Block> = [item("a"), { id: "b", type: "checklist", checked: false, text: "" }];
    assert.equal(indentedDepth(blocks, "b", "in"), null);
  });

  it("returns null for an id that is not in the document", () => {
    assert.equal(indentedDepth([item("a")], "zz", "in"), null);
  });

  it("returns null for an empty document", () => {
    assert.equal(indentedDepth([], "a", "in"), null);
  });
});

describe("preservingDepth", () => {
  it("carries an indented item's depth through a style change", () => {
    assert.deepEqual(
      preservingDepth({ type: "list", style: "ordered" }, item("a", 3)),
      { type: "list", style: "ordered", depth: 3 },
    );
  });

  it("leaves a depth the caller named alone", () => {
    assert.deepEqual(
      preservingDepth({ type: "list", style: "ordered", depth: 1 }, item("a", 3)),
      { type: "list", style: "ordered", depth: 1 },
    );
  });

  it("starts a list made from a paragraph at the top level", () => {
    assert.deepEqual(
      preservingDepth({ type: "list", style: "unordered" }, text("a")),
      { type: "list", style: "unordered" },
    );
  });

  it("does not invent a depth for a non-list target", () => {
    assert.deepEqual(preservingDepth({ type: "quote" }, item("a", 2)), { type: "quote" });
  });

  it("passes through when the block is missing", () => {
    assert.deepEqual(
      preservingDepth({ type: "list", style: "ordered" }, undefined),
      { type: "list", style: "ordered" },
    );
  });
});
