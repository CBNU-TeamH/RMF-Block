import { Text, type JSONArray } from "@yorkie-js/sdk";

import { newBlockId } from "./create.ts";
import type { StoredBlock } from "./document.ts";
import { BlockNotFoundError, type BlockArray } from "./operations.ts";
import type { TextPatch } from "./text-surface.ts";
import type { TableBlock } from "./types.ts";

type Axis = { id: string; deleted?: boolean };
export type StoredTable<T = Text> = {
  rows: Array<Axis>;
  columns: Array<Axis>;
  cells: Array<{ rowId: string; columnId: string; text: T }>;
};
export type CellAddress = { rowId: string; columnId: string };
export type TableAxis = "rows" | "columns";

export const cellKey = (rowId: string, columnId: string): string => `${rowId}_${columnId}`;

/** Tombstones and text fragments preserve concurrent structure changes; see docs/design/document-editing.md. */
function visibleAxis(values: Array<Axis> | undefined): Array<string> {
  if (!values || typeof values[Symbol.iterator] !== "function") return [];
  const axes = [...values].filter((axis) => axis && typeof axis.id === "string" && axis.id !== "");
  const visible = axes.filter((axis) => !axis.deleted);
  return [...new Set((visible.length ? visible : axes.slice(0, 1)).map((axis) => axis.id))];
}

export function readTable(table: StoredTable<{ toString(): string }> | undefined): Omit<TableBlock, "id" | "type"> {
  const rows = visibleAxis(table?.rows);
  const columns = visibleAxis(table?.columns);
  const cells: Record<string, string> = {};
  if (table?.cells && typeof table.cells[Symbol.iterator] === "function") {
    for (const cell of table.cells) {
      if (!cell || !rows.includes(cell.rowId) || !columns.includes(cell.columnId)) continue;
      const key = cellKey(cell.rowId, cell.columnId);
      const text = typeof cell.text === "string" || cell.text instanceof Text ? cell.text.toString() : "";
      cells[key] = (cells[key] ?? "") + text;
    }
  }
  return { rows, columns, cells };
}

export function storeTable(block: TableBlock): StoredTable {
  return {
    rows: block.rows.map((id) => ({ id })),
    columns: block.columns.map((id) => ({ id })),
    cells: block.rows.flatMap((rowId) => block.columns.map((columnId) => ({ rowId, columnId, text: new Text() }))),
  };
}

export function tableOf(blocks: Iterable<StoredBlock>, blockId: string): StoredTable {
  for (const block of blocks) {
    if (block?.id === blockId && block.type === "table" && block.content?.table) return block.content.table;
  }
  throw new BlockNotFoundError(blockId);
}

export function editTableCell(blocks: BlockArray, blockId: string, cell: CellAddress, from: number, to: number, value: string): void {
  const table = tableOf(blocks, blockId);
  if (!visibleAxis(table.rows).includes(cell.rowId) || !visibleAxis(table.columns).includes(cell.columnId)) return;
  const fragments = [...table.cells].filter((entry) => entry.rowId === cell.rowId && entry.columnId === cell.columnId);
  if (!fragments.length) {
    table.cells.push({ rowId: cell.rowId, columnId: cell.columnId, text: new Text() });
    table.cells[table.cells.length - 1]!.text.edit(0, 0, value);
    return;
  }
  let offset = 0;
  let inserted = false;
  for (const fragment of fragments) {
    const length = fragment.text.length;
    const start = Math.max(0, from - offset);
    const end = Math.min(length, to - offset);
    if (start <= length && end >= start) {
      fragment.text.edit(start, end, inserted ? "" : value);
      inserted = true;
    }
    offset += length;
  }
}

export function insertTableAxis(blocks: BlockArray, blockId: string, axis: TableAxis, anchorId: string, before: boolean): string | null {
  const table = tableOf(blocks, blockId);
  const values = table[axis] as JSONArray<Axis>;
  const anchor = [...values.elements()].find((entry) => (entry as unknown as Axis).id === anchorId);
  if (!anchor || !visibleAxis(table[axis]).includes(anchorId)) return null;
  const anchorAxis = anchor as unknown as Axis;
  if (anchorAxis.deleted) anchorAxis.deleted = false;
  const id = newBlockId();
  if (before) values.insertBefore(anchor.getID(), { id });
  else values.insertAfter(anchor.getID(), { id });
  const others = visibleAxis(table[axis === "rows" ? "columns" : "rows"]);
  for (const other of others) {
    table.cells.push({ rowId: axis === "rows" ? id : other, columnId: axis === "columns" ? id : other, text: new Text() });
  }
  return id;
}

export function deleteTableAxis(blocks: BlockArray, blockId: string, axis: TableAxis, id: string): void {
  const table = tableOf(blocks, blockId);
  if (visibleAxis(table[axis]).length <= 1) return;
  for (const entry of table[axis]) {
    if (entry.id === id) entry.deleted = true;
  }
}

/** Restores strings only after their empty CRDT nodes have entered the document. */
export function fillTable(blocks: BlockArray, block: TableBlock): void {
  for (const rowId of block.rows) {
    for (const columnId of block.columns) {
      const text = block.cells[cellKey(rowId, columnId)];
      if (text) editTableCell(blocks, block.id, { rowId, columnId }, 0, 0, text);
    }
  }
}

export type CellChange = TextPatch | { text: string };

/** Maps nested Text operations to cell offsets without guessing edit positions from final strings. */
export function tableCellPatches(
  blocks: Array<StoredBlock>,
  edits: Array<TextPatch & { path: string }>,
): Array<{ key: string; patch: TextPatch }> {
  const tables = new Map<string, { table: StoredTable; lengths: Array<number> }>();
  const resolved = [];
  for (const edit of edits) {
    const match = /^\$\.blocks\.(\d+)\.content\.table\.cells\.(\d+)\.text$/.exec(edit.path);
    if (!match) continue;
    const block = blocks[Number(match[1])];
    const table = block?.content?.table;
    const index = Number(match[2]);
    if (block?.type !== "table" || !table?.cells?.[index]) continue;
    if (!tables.has(block.id)) {
      tables.set(block.id, { table, lengths: [...table.cells].map((cell) => cell.text.length) });
    }
    resolved.push({ blockId: block.id, index, edit });
  }
  for (let i = resolved.length - 1; i >= 0; i--) {
    const { blockId, index, edit } = resolved[i];
    tables.get(blockId)!.lengths[index] -= edit.value.content.length - (edit.to - edit.from);
  }
  const patches = [];
  for (const { blockId, index, edit } of resolved) {
    const { table, lengths } = tables.get(blockId)!;
    const target = table.cells[index];
    let offset = 0;
    for (let i = 0; i < index; i++) {
      if (table.cells[i].rowId === target.rowId && table.cells[i].columnId === target.columnId) offset += lengths[i];
    }
    patches.push({ key: `${blockId}:${cellKey(target.rowId, target.columnId)}`,
      patch: { from: offset + edit.from, to: offset + edit.to, value: edit.value } });
    lengths[index] += edit.value.content.length - (edit.to - edit.from);
  }
  return patches;
}
