import assert from "node:assert/strict";
import { describe, it } from "vitest";

import yorkie, { type Document } from "@yorkie-js/sdk";

import { createHeading, createTable, createText } from "./create.ts";
import { readBlocks, toStoredBlock, type BlockDocumentRoot } from "./document.ts";
import { editBlockText, type BlockArray } from "./operations.ts";
import { replaceAllBlocks } from "./restore.ts";
import { cellKey } from "./table.ts";
import type { Block } from "./types.ts";

let counter = 0;

const contents = (doc: Document<BlockDocumentRoot>) =>
  readBlocks(doc.getRoot().blocks).map((block) => ({
    id: block.id,
    type: block.type,
    text: "text" in block ? block.text : undefined,
    cells: block.type === "table" ? block.cells : undefined,
  }));

describe("replaceAllBlocks (#185)", () => {
  it("restores text and table cells in one step that one undo takes back", () => {
    const doc = new yorkie.Document<BlockDocumentRoot>(`restore-${(counter += 1)}`);
    const old = { ...createText(), text: "old text" };
    doc.update((root) => {
      root.blocks = [toStoredBlock(old)];
    });
    doc.update((root) => editBlockText(root.blocks as BlockArray, old.id, 0, 0, old.text));
    const before = contents(doc);

    const table = createTable(2, 2);
    table.cells[cellKey(table.rows[0]!, table.columns[0]!)] = "a1";
    table.cells[cellKey(table.rows[1]!, table.columns[1]!)] = "b2";
    const next: Array<Block> = [{ ...createHeading(1), text: "new heading" }, table, { ...createText(), text: "new text" }];

    doc.update((root) => replaceAllBlocks(root, next));
    const restored = contents(doc);
    assert.deepEqual(
      restored.map(({ type, text }) => ({ type, text })),
      [
        { type: "heading", text: "new heading" },
        { type: "table", text: undefined },
        { type: "text", text: "new text" },
      ],
    );
    assert.equal(restored[1]?.cells?.[cellKey(table.rows[0]!, table.columns[0]!)], "a1");
    assert.equal(restored[1]?.cells?.[cellKey(table.rows[1]!, table.columns[1]!)], "b2");

    doc.history.undo();
    assert.deepEqual(contents(doc), before);

    doc.history.redo();
    assert.deepEqual(contents(doc), restored);
  });
});
