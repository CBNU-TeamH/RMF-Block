// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import yorkie from "@yorkie-js/sdk";

import { createTable } from "@/lib/blocks/create";
import { readBlocks, toStoredBlock, type BlockDocumentRoot } from "@/lib/blocks/document";
import type { BlockArray } from "@/lib/blocks/operations";
import { cellKey, deleteTableAxis, editTableCell, insertTableAxis, type CellChange } from "@/lib/blocks/table";
import type { TableBlock } from "@/lib/blocks/types";
import { TableBlockView, TablePreview } from "./table-block";

afterEach(cleanup);

function fixture() {
  const table = createTable();
  const doc = new yorkie.Document<BlockDocumentRoot>(`table-ui-${table.id}`);
  doc.update((root) => { root.blocks = [toStoredBlock(table)]; });
  const handlers = new Map<string, (change: CellChange) => void>();
  const onDelete = vi.fn();
  function Harness() {
    const [block, setBlock] = useState(table);
    const publish = () => setBlock(readBlocks(doc.getRoot().blocks)[0] as TableBlock);
    return <TableBlockView block={block} docRef={{ current: doc }} autoFocus
      registerCellHandler={(key, handler) => { handlers.set(key, handler); return () => { handlers.delete(key); }; }}
      onChangeAxis={(axis, anchor, before) => {
        let id: string | null = null;
        doc.update((root) => { id = insertTableAxis(root.blocks as BlockArray, table.id, axis, anchor, before); });
        publish();
        return id;
      }}
      onDeleteAxis={(axis, id) => {
        doc.update((root) => deleteTableAxis(root.blocks as BlockArray, table.id, axis, id));
        publish();
      }} onDelete={onDelete} onFocusBlock={() => {}} onHistory={() => {}} onTextCommitted={publish} />;
  }
  render(<Harness />);
  const cell = (row: number, column: number) => screen.getByRole("textbox", { name: `${row}행 ${column}열` }) as HTMLTextAreaElement;
  const remote = (change: CellChange) => act(() => handlers.get(`${table.id}:${cellKey(table.rows[0], table.columns[0])}`)?.(change));
  return { table, doc, cell, remote, onDelete };
}

const focused = () => document.activeElement?.getAttribute("aria-label");

describe("table surface", () => {
  it("focuses the first cell, navigates both ways and appends a row on final Tab", () => {
    const { cell } = fixture();
    assert.equal(document.activeElement, cell(1, 1));
    fireEvent.keyDown(cell(1, 1), { key: "Tab" });
    assert.equal(document.activeElement, cell(1, 2));
    fireEvent.keyDown(cell(1, 2), { key: "Tab", shiftKey: true });
    assert.equal(document.activeElement, cell(1, 1));
    fireEvent.focus(cell(3, 3));
    fireEvent.keyDown(cell(3, 3), { key: "Tab" });
    assert.equal(document.activeElement, cell(4, 1));
    cell(1, 1).focus();
    fireEvent.keyDown(cell(1, 1), { key: "Tab", shiftKey: true });
    assert.equal(document.activeElement?.textContent, "표 삭제");
  });

  it("keeps Enter, slash and Markdown literal inside cells", () => {
    const { cell, doc } = fixture();
    const el = cell(1, 1);
    assert.equal(fireEvent.keyDown(el, { key: "Enter" }), true);
    fireEvent.input(el, { target: { value: "/table\n# heading" } });
    assert.equal(screen.queryByRole("listbox"), null);
    assert.equal(screen.getAllByRole("row").length, 3);
    const table = readBlocks(doc.getRoot().blocks)[0] as TableBlock;
    assert.equal(table.cells[cellKey(table.rows[0], table.columns[0])], "/table\n# heading");
  });

  it("adds axes from the boundary and end buttons and focuses the new cell", () => {
    fixture();
    fireEvent.click(screen.getByRole("button", { name: "오른쪽 끝에 열 추가" }));
    assert.equal(screen.getAllByRole("textbox").length, 12);
    assert.equal(focused(), "1행 4열");
    fireEvent.click(screen.getByRole("button", { name: "아래쪽 끝에 행 추가" }));
    assert.equal(focused(), "4행 4열");
    fireEvent.click(screen.getByRole("button", { name: "2열 앞에 열 추가" }));
    assert.equal(focused(), "4행 2열");
    fireEvent.click(screen.getByRole("button", { name: "1행 앞에 행 추가" }));
    assert.equal(screen.getAllByRole("textbox").length, 25);
    assert.equal(focused(), "1행 2열");
  });

  it("opens an axis menu to insert and delete, refocusing the cell, and disables deletion at 1 by 1", () => {
    const { cell } = fixture();
    act(() => cell(2, 2).focus());
    fireEvent.click(screen.getByRole("button", { name: "2행 메뉴" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "행 삭제" }));
    assert.equal(screen.queryByRole("menu"), null);
    assert.equal(focused(), "2행 2열");
    fireEvent.click(screen.getByRole("button", { name: "2행 메뉴" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "행 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "1행 메뉴" }));
    assert.equal((screen.getByRole("menuitem", { name: "행 삭제" }) as HTMLButtonElement).disabled, true);
    fireEvent.keyDown(document, { key: "Escape" });
    assert.equal(screen.queryByRole("menu"), null);
    fireEvent.click(screen.getByRole("button", { name: "2열 메뉴" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "왼쪽에 열 추가" }));
    assert.equal(focused(), "1행 2열");
    assert.equal(screen.getAllByRole("textbox").length, 4);
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole("button", { name: "1열 메뉴" }));
      fireEvent.click(screen.getByRole("menuitem", { name: "열 삭제" }));
    }
    assert.equal(screen.getAllByRole("textbox").length, 1);
    fireEvent.click(screen.getByRole("button", { name: "1열 메뉴" }));
    assert.equal((screen.getByRole("menuitem", { name: "열 삭제" }) as HTMLButtonElement).disabled, true);
  });

  it("rebases multiple remote cell changes during a Hangul composition", () => {
    const { cell, table, doc, remote } = fixture();
    const el = cell(1, 1);
    fireEvent.input(el, { target: { value: "abc" } });
    el.setSelectionRange(3, 3);
    fireEvent.compositionStart(el);
    fireEvent.input(el, { target: { value: "abc안" } });
    doc.update((root) => editTableCell(root.blocks as BlockArray, table.id, { rowId: table.rows[0], columnId: table.columns[0] }, 0, 0, "X"));
    remote({ from: 0, to: 0, value: { content: "X" } });
    remote({ text: "Xabc" });
    doc.update((root) => editTableCell(root.blocks as BlockArray, table.id, { rowId: table.rows[0], columnId: table.columns[0] }, 1, 1, "Y"));
    remote({ from: 1, to: 1, value: { content: "Y" } });
    remote({ text: "XYabc" });
    assert.equal(el.value, "abc안");
    fireEvent.compositionEnd(el);
    assert.equal(el.value, "XYabc안");
    assert.equal((readBlocks(doc.getRoot().blocks)[0] as TableBlock).cells[cellKey(table.rows[0], table.columns[0])], "XYabc안");
    fireEvent.input(el, { target: { value: "XYabc안녕" } });
    assert.equal((readBlocks(doc.getRoot().blocks)[0] as TableBlock).cells[cellKey(table.rows[0], table.columns[0])], "XYabc안녕");
  });

  it("preserves original remote insertion positions inside repeated text during IME", () => {
    const { cell, table, doc, remote } = fixture();
    const el = cell(1, 1);
    fireEvent.input(el, { target: { value: "aaa" } });
    el.setSelectionRange(1, 1);
    fireEvent.compositionStart(el);
    fireEvent.input(el, { target: { value: "a안aa" } });
    doc.update((root) => editTableCell(root.blocks as BlockArray, table.id, { rowId: table.rows[0], columnId: table.columns[0] }, 0, 0, "a"));
    remote({ from: 0, to: 0, value: { content: "a" } });
    remote({ text: "aaaa" });
    fireEvent.compositionEnd(el);
    assert.equal(el.value, "aa안aa");
    assert.equal((readBlocks(doc.getRoot().blocks)[0] as TableBlock).cells[cellKey(table.rows[0], table.columns[0])], "aa안aa");
  });

  it("requires confirmation before deleting the entire table", () => {
    const { onDelete } = fixture();
    fireEvent.click(screen.getByRole("button", { name: "표 삭제" }));
    assert.equal(onDelete.mock.calls.length, 0);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    assert.equal(onDelete.mock.calls.length, 0);
    fireEvent.click(screen.getByRole("button", { name: "표 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    assert.equal(onDelete.mock.calls.length, 1);
  });

  it("renders a read-only table preview without inputs", () => {
    const table = createTable();
    table.cells[cellKey(table.rows[0], table.columns[0])] = "header";
    table.cells[cellKey(table.rows[1], table.columns[1])] = "body\ntext";
    render(<TablePreview block={table} />);
    assert.equal(screen.getAllByRole("columnheader").length, 3);
    assert.equal(screen.queryByRole("textbox"), null);
    assert.ok(screen.getByText("body text"));
  });
});
