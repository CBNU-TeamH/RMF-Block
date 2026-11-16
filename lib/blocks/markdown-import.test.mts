import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { blocksFromMarkdown } from "./markdown-import.ts";
import { cellKey } from "./table.ts";

const shape = (text: string) => blocksFromMarkdown(text).map((block) => [block.type, "text" in block ? block.text : null]);

describe("blocksFromMarkdown", () => {
  it("reads a file as a paste, without the blank lines between paragraphs", () => {
    assert.deepEqual(shape("# Title\n\nFirst paragraph.\n\n- one\n- two\n\n\n> quoted\n"), [
      ["heading", "Title"],
      ["text", "First paragraph."],
      ["list", "one"],
      ["list", "two"],
      ["quote", "quoted"],
    ]);
  });

  it("keeps a block whose own text is empty, and returns nothing for a blank file", () => {
    assert.deepEqual(shape("- \n"), [["list", ""]]);
    assert.deepEqual(shape("\n \n\n"), []);
    assert.deepEqual(shape(""), []);
  });

  it("keeps a divider and a table, the table's text in its cells", () => {
    const [divider, table] = blocksFromMarkdown("---\n\n| a | b |\n| - | - |\n| c | d |\n");
    assert.equal(divider?.type, "divider");
    assert.equal(table?.type, "table");
    if (table?.type !== "table") return;
    assert.deepEqual(
      table.rows.map((row) => table.columns.map((column) => table.cells[cellKey(row, column)] ?? "")),
      [["a", "b"], ["c", "d"]],
    );
  });

  it("gives every block its own id", () => {
    const ids = blocksFromMarkdown("a\nb\nc").map((block) => block.id);
    assert.equal(new Set(ids).size, 3);
  });
});
