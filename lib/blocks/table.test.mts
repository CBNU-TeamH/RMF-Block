import assert from "node:assert/strict";
import { describe, it } from "vitest";
import yorkie from "@yorkie-js/sdk";

import { createTable } from "./create.ts";
import { readBlocks, toStoredBlock, type BlockDocumentRoot } from "./document.ts";
import type { BlockArray } from "./operations.ts";
import { readRevisionBlocks } from "./revision-snapshot.ts";
import { cellKey, deleteTableAxis, editTableCell, fillTable, insertTableAxis, readTable, tableOf, tableCellPatches } from "./table.ts";

function fixture() {
  const block = createTable();
  const doc = new yorkie.Document<BlockDocumentRoot>(`table-${block.id}`);
  doc.update((root) => { root.blocks = [toStoredBlock(block)]; });
  const edit = (action: (blocks: BlockArray) => void) => doc.update((root) => action(root.blocks as BlockArray));
  const read = () => readTable(doc.getRoot().blocks[0].content?.table);
  const cell = { rowId: block.rows[0], columnId: block.columns[0] };
  return { block, doc, edit, read, cell };
}

describe("table blocks", () => {
  it("creates a 3 by 3 table with independent cells and stable axes", () => {
    const { block, edit, read, cell } = fixture();
    assert.equal(new Set([...block.rows, ...block.columns]).size, 6);
    edit((blocks) => editTableCell(blocks, block.id, cell, 0, 0, "안녕"));
    assert.equal(read().cells[cellKey(cell.rowId, cell.columnId)], "안녕");
    assert.equal(read().cells[cellKey(block.rows[1], block.columns[0])], "");
  });

  it("inserts axes before/after the selected ID without changing cell identity", () => {
    const { block, edit, read, cell } = fixture();
    edit((blocks) => editTableCell(blocks, block.id, cell, 0, 0, "kept"));
    let row = "";
    edit((blocks) => { row = insertTableAxis(blocks, block.id, "rows", block.rows[0], true)!; });
    edit((blocks) => insertTableAxis(blocks, block.id, "columns", block.columns[0], false));
    assert.equal(read().rows[0], row);
    assert.equal(read().columns[0], block.columns[0]);
    assert.equal(read().columns[2], block.columns[1]);
    assert.equal(read().cells[cellKey(cell.rowId, cell.columnId)], "kept");
  });

  it("keeps at least one row and column and ignores edits to deleted cells", () => {
    const { block, edit, read, cell } = fixture();
    for (const row of block.rows) edit((blocks) => deleteTableAxis(blocks, block.id, "rows", row));
    for (const column of block.columns) edit((blocks) => deleteTableAxis(blocks, block.id, "columns", column));
    assert.equal(read().rows.length, 1);
    assert.equal(read().columns.length, 1);
    edit((blocks) => editTableCell(blocks, block.id, cell, 0, 0, "discarded"));
    assert.ok(!Object.values(read().cells).includes("discarded"));
    assert.equal(read().cells[cellKey(block.rows[2], block.columns[2])], "");
  });

  it("renders a deterministic surviving axis when concurrent deletions tombstone every entry", () => {
    const { block, edit, read } = fixture();
    edit((blocks) => {
      const table = tableOf(blocks, block.id);
      for (const row of table.rows) row.deleted = true;
      for (const column of table.columns) column.deleted = true;
    });
    assert.deepEqual(read().rows, [block.rows[0]]);
    assert.deepEqual(read().columns, [block.columns[0]]);
  });

  it("keeps the fallback survivor and its text when a new axis is added", () => {
    const { block, edit, read, cell } = fixture();
    edit((blocks) => {
      const table = tableOf(blocks, block.id);
      for (const row of table.rows) row.deleted = true;
      for (const column of table.columns) column.deleted = true;
      editTableCell(blocks, block.id, cell, 0, 0, "survivor");
    });
    edit((blocks) => insertTableAxis(blocks, block.id, "rows", cell.rowId, false));
    edit((blocks) => insertTableAxis(blocks, block.id, "columns", cell.columnId, true));
    assert.equal(read().rows.length, 2);
    assert.equal(read().columns.length, 2);
    assert.equal(read().cells[cellKey(cell.rowId, cell.columnId)], "survivor");
  });

  it("maps original edit positions across duplicate fragments in event order", () => {
    const { block, doc, edit, cell } = fixture();
    edit((blocks) => {
      const table = tableOf(blocks, block.id);
      table.cells = [{ ...cell, text: new yorkie.Text() }, { ...cell, text: new yorkie.Text() }];
      table.cells[0].text.edit(0, 0, "aa");
      table.cells[1].text.edit(0, 0, "bb");
    });
    const patches = tableCellPatches(doc.getRoot().blocks, [
      { path: "$.blocks.0.content.table.cells.0.text", from: 0, to: 0, value: { content: "a" } },
      { path: "$.blocks.0.content.table.cells.1.text", from: 1, to: 1, value: { content: "b" } },
    ]);
    assert.deepEqual(patches.map((entry) => entry.patch), [
      { from: 0, to: 0, value: { content: "a" } },
      { from: 3, to: 3, value: { content: "b" } },
    ]);
    assert.equal(patches[0].key, `${block.id}:${cellKey(cell.rowId, cell.columnId)}`);
  });

  it("creates a missing row/column intersection lazily and merges duplicate fragments", () => {
    const { block, edit, read, cell } = fixture();
    edit((blocks) => { tableOf(blocks, block.id).cells = []; });
    const binding = { ...cell, onTab: () => {}, register: () => {} };
    edit((blocks) => editTableCell(blocks, block.id, binding, 0, 0, "A"));
    edit((blocks) => {
      const table = tableOf(blocks, block.id);
      table.cells.push({ ...cell, text: new yorkie.Text() });
      table.cells[1].text.edit(0, 0, "B");
    });
    assert.equal(read().cells[cellKey(cell.rowId, cell.columnId)], "AB");
    edit((blocks) => editTableCell(blocks, block.id, cell, 1, 2, "C"));
    assert.equal(read().cells[cellKey(cell.rowId, cell.columnId)], "AC");
    edit((blocks) => editTableCell(blocks, block.id, cell, 0, 2, "merged"));
    assert.equal(read().cells[cellKey(cell.rowId, cell.columnId)], "merged");
  });

  it("undoes and redoes cell text and structure", () => {
    const { block, doc, edit, read, cell } = fixture();
    edit((blocks) => editTableCell(blocks, block.id, cell, 0, 0, "text"));
    doc.history.undo();
    assert.equal(read().cells[cellKey(cell.rowId, cell.columnId)], "");
    doc.history.redo();
    assert.equal(read().cells[cellKey(cell.rowId, cell.columnId)], "text");
    edit((blocks) => deleteTableAxis(blocks, block.id, "rows", cell.rowId));
    doc.history.undo();
    assert.equal(read().cells[cellKey(cell.rowId, cell.columnId)], "text");
  });

  it("reads a nested YSON snapshot and restores its strings into fresh CRDT nodes", () => {
    const snapshot = '{"blocks":[{"id":"t","type":"table","content":{"table":{"rows":[{"id":"r"}],"columns":[{"id":"c"}],"cells":[{"rowId":"r","columnId":"c","text":Text([{"val":"한글 "},{"val":"[표]"}])}]}}}]}';
    const [block] = readRevisionBlocks(snapshot);
    assert.equal(block.type, "table");
    if (block.type !== "table") return;
    const { doc } = fixture();
    doc.update((root) => { root.blocks = [toStoredBlock(block)]; });
    doc.update((root) => fillTable(root.blocks as BlockArray, block));
    assert.deepEqual(readBlocks(doc.getRoot().blocks)[0], block);
  });

  it("reads malformed table fields without losing adjacent blocks", () => {
    assert.deepEqual(readTable(undefined), { rows: [], columns: [], cells: {} });
    assert.deepEqual(readTable({ rows: [null, { id: "r" }], columns: [{ id: "c" }], cells: [null, { rowId: "r", columnId: "c", text: 4 }] } as never), {
      rows: ["r"], columns: ["c"], cells: { r_c: "" },
    });
  });
});
