import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  blockIndexFromEditPath,
  diffRange,
  shiftCaret,
  touchesBlockList,
} from "./text-surface.ts";

describe("diffRange", () => {
  const cases: Array<[string, string]> = [
    ["", "a"],
    ["abc", "abc"],
    ["abc", "axc"],
    ["abc", "abcd"],
    ["abc", "ab"],
    ["abc", ""],
    ["가나다", "가나다라"],
    ["가나다", "가다"],
    ["", ""],
    ["ab", "ba"],
  ];

  for (const [oldStr, newStr] of cases) {
    it(`turns "${oldStr}" into "${newStr}"`, () => {
      const { from, to, value } = diffRange(oldStr, newStr);
      assert.equal(oldStr.slice(0, from) + value + oldStr.slice(to), newStr);
    });
  }

  it("reports the smallest range, not just any range that works", () => {
    // A correct-but-wasteful diff would be [0, 3) → "abd" for "abc" → "abd".
    // Only the changed character should move.
    assert.deepEqual(diffRange("abc", "abd"), { from: 2, to: 3, value: "d" });
  });
});

describe("shiftCaret", () => {
  it("shifts a caret after the edit by the size difference (insert)", () => {
    // Measured against a live remote edit in Step 0: caret at 5, a 1-character
    // insert at position 1, caret became 6.
    assert.equal(shiftCaret(5, { from: 1, to: 1, insertedLength: 1 }), 6);
  });

  it("leaves a caret before the edit alone", () => {
    assert.equal(shiftCaret(0, { from: 5, to: 5, insertedLength: 1 }), 0);
  });

  it("shifts a caret after a delete back by what was removed", () => {
    assert.equal(shiftCaret(10, { from: 2, to: 5, insertedLength: 0 }), 7);
  });

  it("returns null when the edit overlaps the caret", () => {
    assert.equal(shiftCaret(3, { from: 1, to: 5, insertedLength: 2 }), null);
  });

  it("treats a caret exactly at the edit's end as after it", () => {
    // Replacing 4 characters (positions 1-5) with 3 shortens the string by
    // one, so a caret sitting right at the end of the edit follows it back.
    assert.equal(shiftCaret(5, { from: 1, to: 5, insertedLength: 3 }), 4);
  });

  it("treats a caret exactly at the edit's start as before it", () => {
    assert.equal(shiftCaret(1, { from: 1, to: 5, insertedLength: 3 }), 1);
  });
});

describe("blockIndexFromEditPath", () => {
  it("reads the index out of a text-edit path", () => {
    assert.equal(blockIndexFromEditPath("$.blocks.3.content.text"), 3);
  });

  it("reads a multi-digit index", () => {
    assert.equal(blockIndexFromEditPath("$.blocks.42.content.text"), 42);
  });

  it("returns null for a path that is not a block's text", () => {
    assert.equal(blockIndexFromEditPath("$.blocks.3.content.level"), null);
    assert.equal(blockIndexFromEditPath("$.blocks"), null);
    assert.equal(blockIndexFromEditPath(""), null);
  });
});

describe("touchesBlockList", () => {
  it("recomputes for a change to the array itself", () => {
    // A split, merge or reorder: add, remove, move.
    assert.equal(touchesBlockList("$.blocks"), true);
  });

  it("recomputes for a conversion's set on one block", () => {
    // `changeBlockType` writes `type` here…
    assert.equal(touchesBlockList("$.blocks.0"), true);
    assert.equal(touchesBlockList("$.blocks.12"), true);
    // …and level/style/checked one level down. Missing this made a peer's
    // heading conversion invisible until some unrelated later edit.
    assert.equal(touchesBlockList("$.blocks.3.content"), true);
  });

  it("leaves other parts of the document alone", () => {
    for (const path of ["$", "$.chat", "$.title", ""]) {
      assert.equal(touchesBlockList(path), false, JSON.stringify(path));
    }
  });

  it("is not fooled by a key that merely starts the same way", () => {
    // The dot is what does this: without it, a future `root.blocksOrder`
    // would drag the whole list through a recompute on every change.
    for (const path of ["$.blocksOrder", "$.blocksomething", "$.blocks2"]) {
      assert.equal(touchesBlockList(path), false, path);
    }
  });
});
