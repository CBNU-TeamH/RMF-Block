import { useEffect, useRef, useState } from "react";
import type { Document } from "@yorkie-js/sdk";

import type { BlockDocumentRoot } from "@/lib/blocks/document";
import { cellKey, type CellAddress, type CellChange, type TableAxis } from "@/lib/blocks/table";
import type { TableBlock } from "@/lib/blocks/types";
import { TextBlockView } from "./text-block";

const noop = () => {};
const unusedTextActions = {
  onMarkdownShortcut: noop, onSplit: noop, onMergeWithPrevious: noop,
  onNavigateUp: noop, onNavigateDown: noop, onSlashSelect: noop, onIndent: noop,
  onPasteBlocks: noop, registerRemoteHandler: () => noop,
};
const AXIS_LABELS = {
  rows: ["위에 행 추가", "아래에 행 추가"],
  columns: ["왼쪽에 열 추가", "오른쪽에 열 추가"],
};
const BUTTON = "rounded-control px-2 py-1 text-xs text-ink-soft hover:bg-hover disabled:opacity-50";

export function TablePreview({ block }: { block: TableBlock }) {
  return (
    <div className="overflow-x-auto">
      <table aria-label="표" className="w-full border-collapse text-sm text-ink">
        <tbody>{block.rows.map((row, index) => (
          <tr key={row}>{block.columns.map((column) => {
            const Cell = index === 0 ? "th" : "td";
            return <Cell key={column} scope={index === 0 ? "col" : undefined} className="border border-line px-3 py-2 text-left whitespace-pre-wrap">{block.cells[cellKey(row, column)] ?? ""}</Cell>;
          })}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function TableBlockView({ block, docRef, registerCellHandler, onChangeAxis, onDeleteAxis, onDelete,
  onFocusBlock, onHistory, onTextCommitted, autoFocus = false,
}: {
  block: TableBlock;
  docRef: React.RefObject<Document<BlockDocumentRoot> | null>;
  registerCellHandler: (key: string, handler: (change: CellChange) => void) => () => void;
  onChangeAxis: (axis: TableAxis, anchor: string, before: boolean) => string | null;
  onDeleteAxis: (axis: TableAxis, id: string) => void;
  onDelete: () => void;
  onFocusBlock: (blockId: string | null) => void;
  onHistory: (direction: "undo" | "redo") => void;
  onTextCommitted: () => void;
  autoFocus?: boolean;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [selected, setSelected] = useState<CellAddress | null>(null);
  const elements = useRef(new Map<string, HTMLTextAreaElement>());
  const pending = useRef<CellAddress | null>(null);
  const focused = useRef(false);
  const initialFocus = useRef(autoFocus);
  const current = selected && block.rows.includes(selected.rowId) && block.columns.includes(selected.columnId)
    ? selected : { rowId: block.rows[0], columnId: block.columns[0] };

  useEffect(() => {
    const selectionRemoved = selected && (!block.rows.includes(selected.rowId) || !block.columns.includes(selected.columnId));
    let target = pending.current;
    if (!target && (initialFocus.current || (selectionRemoved && focused.current))) {
      target = { rowId: block.rows[0], columnId: block.columns[0] };
    }
    if (!target?.rowId || !target.columnId) return;
    const el = elements.current.get(cellKey(target.rowId, target.columnId));
    if (!el) return;
    pending.current = null;
    initialFocus.current = false;
    el.focus();
  }, [block, selected]);

  const focusCell = (target: CellAddress) => {
    const el = elements.current.get(cellKey(target.rowId, target.columnId));
    if (el) el.focus();
    else pending.current = target;
  };
  const tab = (cell: CellAddress, backwards: boolean) => {
    const index = block.rows.indexOf(cell.rowId) * block.columns.length + block.columns.indexOf(cell.columnId);
    const next = index + (backwards ? -1 : 1);
    if (next < 0) {
      const toolbar = elements.current.get(cellKey(cell.rowId, cell.columnId))?.closest("[data-table-block]");
      toolbar?.querySelector<HTMLButtonElement>("button")?.focus();
      return;
    }
    if (next === block.rows.length * block.columns.length) {
      const rowId = onChangeAxis("rows", cell.rowId, false);
      if (rowId) pending.current = { rowId, columnId: block.columns[0] };
      return;
    }
    focusCell({ rowId: block.rows[Math.floor(next / block.columns.length)], columnId: block.columns[next % block.columns.length] });
  };
  const currentId = (axis: TableAxis) => (axis === "rows" ? current.rowId : current.columnId);
  const cellOnAxis = (axis: TableAxis, id: string): CellAddress => ({
    rowId: axis === "rows" ? id : current.rowId,
    columnId: axis === "columns" ? id : current.columnId,
  });
  const removeAxis = (axis: TableAxis) => {
    const id = currentId(axis);
    if (!id || block[axis].length <= 1) return;
    const index = block[axis].indexOf(id);
    pending.current = cellOnAxis(axis, block[axis][index + 1] ?? block[axis][index - 1]);
    onDeleteAxis(axis, id);
  };

  return (
    <div data-table-block className="min-w-0 py-2">
      <div role="toolbar" aria-label="표 편집" className="mb-2 flex flex-wrap gap-1">
        {(["rows", "columns"] as const).map((axis) => (
          <span key={axis}>
            {[true, false].map((before) => (
              <button key={String(before)} type="button" className={BUTTON}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  const id = currentId(axis);
                  if (!id) return;
                  const added = onChangeAxis(axis, id, before);
                  if (added) pending.current = cellOnAxis(axis, added);
                }}>
                {AXIS_LABELS[axis][before ? 0 : 1]}
              </button>
            ))}
            <button type="button" className={BUTTON} disabled={block[axis].length <= 1}
              onMouseDown={(event) => event.preventDefault()} onClick={() => removeAxis(axis)}>
              {axis === "rows" ? "행 삭제" : "열 삭제"}
            </button>
          </span>
        ))}
        {confirmingDelete ? (
          <span className="flex items-center gap-1">
            <button type="button" className="h-6 rounded-control bg-danger px-2 text-xs font-semibold text-paper" onClick={onDelete}>삭제</button>
            <button type="button" className={BUTTON} onClick={() => setConfirmingDelete(false)}>취소</button>
          </span>
        ) : (
          <button type="button" className={BUTTON} onClick={() => setConfirmingDelete(true)}>표 삭제</button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table aria-label="표" className="w-full border-collapse text-ink">
          <tbody>{block.rows.map((rowId, rowIndex) => (
            <tr key={rowId} data-table-row-id={rowId}>{block.columns.map((columnId, columnIndex) => {
              const key = cellKey(rowId, columnId);
              return (
                <td key={columnId} data-table-column-id={columnId}
                  role={rowIndex === 0 ? "columnheader" : "cell"}
                  className={`border border-line px-3 py-2 align-top ${rowIndex === 0 ? "bg-hover font-semibold" : ""}`}
                  style={{ minWidth: 140 }}>
                  <TextBlockView {...unusedTextActions} blockId={block.id}
                    initialText={block.cells[key] ?? ""} variant={{ type: "text" }} docRef={docRef}
                    cellBinding={{ rowId, columnId, label: `${rowIndex + 1}행 ${columnIndex + 1}열`, register: registerCellHandler,
                      onTab: (backwards) => tab({ rowId, columnId }, backwards) }}
                    registerTextarea={(_blockId, el) => { if (el) elements.current.set(key, el); else elements.current.delete(key); }}
                    onFocusBlock={(id) => {
                      focused.current = id !== null;
                      if (id) setSelected({ rowId, columnId });
                      onFocusBlock(id);
                    }} onHistory={onHistory} onTextCommitted={onTextCommitted} />
                </td>
              );
            })}</tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
