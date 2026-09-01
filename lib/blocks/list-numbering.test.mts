import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { orderedListNumbers } from "./list-numbering.ts";
import type { Block } from "./types.ts";

const text = (id: string): Block => ({ id, type: "text", text: "" });
const ordered = (id: string): Block => ({ id, type: "list", style: "ordered", depth: 0, text: "" });
const unordered = (id: string): Block => ({ id, type: "list", style: "unordered", depth: 0, text: "" });

describe("orderedListNumbers", () => {
  it("numbers a run of consecutive ordered items from 1", () => {
    assert.deepEqual(orderedListNumbers([ordered("a"), ordered("b"), ordered("c")]), [1, 2, 3]);
  });

  it("gives every non-ordered-list block 0", () => {
    assert.deepEqual(orderedListNumbers([text("a"), unordered("b")]), [0, 0]);
  });

  it("restarts the count after a break in the run", () => {
    assert.deepEqual(
      orderedListNumbers([ordered("a"), ordered("b"), text("c"), ordered("d")]),
      [1, 2, 0, 1],
    );
  });

  it("restarts after an unordered list breaks the ordered run", () => {
    assert.deepEqual(
      orderedListNumbers([ordered("a"), unordered("b"), ordered("c")]),
      [1, 0, 1],
    );
  });

  it("returns an empty array for an empty document", () => {
    assert.deepEqual(orderedListNumbers([]), []);
  });
});
