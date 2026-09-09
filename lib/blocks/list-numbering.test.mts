import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { orderedListNumbers } from "./list-numbering.ts";
import type { Block } from "./types.ts";

const text = (id: string): Block => ({ id, type: "text", text: "" });
const ordered = (id: string, depth = 0): Block => ({ id, type: "list", style: "ordered", depth, text: "" });
const unordered = (id: string, depth = 0): Block => ({ id, type: "list", style: "unordered", depth, text: "" });

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

  it("starts a nested run at 1 and resumes the outer one after it", () => {
    assert.deepEqual(
      orderedListNumbers([ordered("a", 0), ordered("b", 1), ordered("c", 0)]),
      [1, 1, 2],
    );
  });

  it("counts a nested run of its own", () => {
    assert.deepEqual(
      orderedListNumbers([ordered("a", 0), ordered("b", 1), ordered("c", 1), ordered("d", 0)]),
      [1, 1, 2, 2],
    );
  });

  it("starts a second nested run over rather than resuming the first", () => {
    assert.deepEqual(
      orderedListNumbers([
        ordered("a", 0),
        ordered("b", 1),
        ordered("c", 0),
        ordered("d", 1),
      ]),
      [1, 1, 2, 1],
    );
  });

  it("lets an outer numbered list survive a bulleted child", () => {
    assert.deepEqual(
      orderedListNumbers([ordered("a", 0), unordered("b", 1), ordered("c", 0)]),
      [1, 0, 2],
    );
  });

  it("numbers three levels independently", () => {
    assert.deepEqual(
      orderedListNumbers([
        ordered("a", 0),
        ordered("b", 1),
        ordered("c", 2),
        ordered("d", 2),
        ordered("e", 1),
        ordered("f", 0),
      ]),
      [1, 1, 1, 2, 2, 2],
    );
  });

  it("drops every level when a non-list block interrupts", () => {
    assert.deepEqual(
      orderedListNumbers([ordered("a", 0), ordered("b", 1), text("c"), ordered("d", 1)]),
      [1, 1, 0, 1],
    );
  });
});
