import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WorkspaceDocument } from "./documents.ts";
import { childrenOf, subtreeIds, treeRows, wouldCycle } from "./tree.ts";

const doc = (id: string, parentId: string | null = null): WorkspaceDocument => ({
  id,
  name: id,
  parentId,
  createdBy: "u",
  createdAt: "2026-09-08T00:00:00.000Z",
  updatedAt: "2026-09-08T00:00:00.000Z",
});

//  a ── b ── d
//    └─ c
//  e (root)
const tree = [doc("a"), doc("b", "a"), doc("c", "a"), doc("d", "b"), doc("e")];

describe("childrenOf", () => {
  it("finds a node's own children only", () => {
    assert.deepEqual(childrenOf(tree, "a").map((d) => d.id), ["b", "c"]);
    assert.deepEqual(childrenOf(tree, "b").map((d) => d.id), ["d"]);
  });

  it("treats null as the root", () => {
    assert.deepEqual(childrenOf(tree, null).map((d) => d.id), ["a", "e"]);
  });

  it("treats a missing parentId as the root — a pre-tree catalogue", () => {
    const old = [{ ...doc("x"), parentId: undefined }] as Array<WorkspaceDocument>;
    assert.deepEqual(childrenOf(old, null).map((d) => d.id), ["x"]);
  });

  it("returns nothing for a leaf", () => {
    assert.deepEqual(childrenOf(tree, "d"), []);
  });
});

describe("subtreeIds", () => {
  it("includes the node itself", () => {
    assert.deepEqual(subtreeIds(tree, "e"), ["e"]);
  });

  it("includes every descendant — what a cascading delete removes", () => {
    assert.deepEqual(subtreeIds(tree, "a").sort(), ["a", "b", "c", "d"]);
  });

  it("terminates on a catalogue that already holds a cycle", () => {
    // Not reachable through `wouldCycle`, but a hand-edited file can hold one
    // and this must not hang the server that reads it.
    const cyclic = [doc("p", "q"), doc("q", "p")];
    assert.deepEqual(subtreeIds(cyclic, "p").sort(), ["p", "q"]);
  });
});

describe("wouldCycle", () => {
  it("allows a move to the root", () => {
    assert.equal(wouldCycle(tree, "b", null), false);
  });

  it("allows a move to an unrelated document", () => {
    assert.equal(wouldCycle(tree, "b", "e"), false);
  });

  it("refuses making a document its own parent", () => {
    assert.equal(wouldCycle(tree, "a", "a"), true);
  });

  it("refuses moving a parent under its own child", () => {
    assert.equal(wouldCycle(tree, "a", "b"), true);
  });

  it("refuses moving a parent under a deeper descendant", () => {
    assert.equal(wouldCycle(tree, "a", "d"), true);
  });

  it("allows moving a child under its own sibling", () => {
    assert.equal(wouldCycle(tree, "b", "c"), false);
  });
});

describe("treeRows", () => {
  it("puts parents before their children, with a depth for each", () => {
    assert.deepEqual(
      treeRows(tree).map((r) => [r.document.id, r.depth]),
      [["a", 0], ["b", 1], ["d", 2], ["c", 1], ["e", 0]],
    );
  });

  it("marks which rows have children, so a renderer needs no second pass", () => {
    const has = Object.fromEntries(treeRows(tree).map((r) => [r.document.id, r.hasChildren]));
    assert.deepEqual(has, { a: true, b: true, d: false, c: false, e: false });
  });

  it("leaves a collapsed node's descendants out entirely", () => {
    assert.deepEqual(
      treeRows(tree, new Set(["a"])).map((r) => r.document.id),
      ["a", "e"],
    );
  });

  it("collapses only the named node, not its siblings", () => {
    assert.deepEqual(
      treeRows(tree, new Set(["b"])).map((r) => r.document.id),
      ["a", "b", "c", "e"],
    );
  });

  it("renders a document whose parent is gone as a root", () => {
    // FR-023-04 deletes a parent; a catalogue read mid-write, or one an older
    // build left, must still draw every document rather than none.
    const orphaned = [doc("a"), doc("lost", "deleted-id")];
    assert.deepEqual(treeRows(orphaned).map((r) => [r.document.id, r.depth]), [["a", 0], ["lost", 0]]);
  });

  it("returns nothing for an empty catalogue", () => {
    assert.deepEqual(treeRows([]), []);
  });
});
