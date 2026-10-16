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
// Hovering the table reveals its controls; a control that has keyboard focus shows itself.
const REVEAL = "opacity-0 group-hover/table:opacity-100 focus:opacity-100";
const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-sky-ring";
// Only the "+" under the pointer shows, so a boundary is not marked until it is reached for.
const PLUS = `absolute z-10 flex size-4 items-center justify-center rounded-full bg-sky-deep text-[13px] leading-none text-paper opacity-0 hover:opacity-100 focus:opacity-100 ${FOCUS_RING}`;
const GRIP = `absolute z-10 rounded-full bg-line-strong hover:bg-sky-deep aria-expanded:bg-sky-deep aria-expanded:opacity-100 ${FOCUS_RING} ${REVEAL}`;
const EDGE = `absolute z-10 flex items-center justify-center rounded text-ink-faint hover:bg-sky-soft hover:text-ink ${FOCUS_RING} ${REVEAL}`;
const BUTTON = "rounded-control px-2 py-1 text-xs text-ink-soft hover:bg-hover";
const MENU_ITEM = "flex h-[30px] w-full items-center rounded-control px-2 text-left text-[14px] text-ink outline-none hover:bg-hover focus:bg-hover focus-visible:ring-2 focus-visible:ring-sky-deep focus-visible:ring-inset";
const MENU_WIDTH_PX = 168;
const MENU_HEIGHT_PX = 124;
const MENU_ITEMS = {
  rows: [{ label: "위에 행 추가", before: true }, { label: "아래에 행 추가", before: false }],
  columns: [{ label: "왼쪽에 열 추가", before: true }, { label: "오른쪽에 열 추가", before: false }],
};
const DELETE_LABEL = { rows: "행 삭제", columns: "열 삭제" };
type AxisMenu = { axis: TableAxis; id: string; top: number; left: number };

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

  const [menu, setMenu] = useState<AxisMenu | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const menuOpen = menu !== null;

  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector("button")?.focus();
    const close = () => setMenu(null);
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !trigger.current?.contains(target)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menuOpen]);

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
  const add = (axis: TableAxis, id: string, before: boolean) => {
    const added = onChangeAxis(axis, id, before);
    if (added) pending.current = cellOnAxis(axis, added);
  };
  const removeAxis = (axis: TableAxis, id: string) => {
    if (block[axis].length <= 1) return;
    const index = block[axis].indexOf(id);
    const next = block[axis][index + 1] ?? block[axis][index - 1];
    // The menu took focus from the cell, so always put it back — on the neighbour when the
    // selected cell's own row or column is the one going away.
    pending.current = cellOnAxis(axis, id === currentId(axis) ? next : currentId(axis));
    onDeleteAxis(axis, id);
  };
  const toggleMenu = (axis: TableAxis, id: string, el: HTMLElement) => {
    trigger.current = el;
    if (menu?.id === id) return setMenu(null);
    const rect = el.getBoundingClientRect();
    const left = axis === "rows" ? rect.right + 4 : rect.left;
    const top = axis === "rows" ? rect.top : rect.bottom + 4;
    setMenu({ axis, id, top: Math.max(8, Math.min(top, window.innerHeight - MENU_HEIGHT_PX - 8)), left: Math.min(left, window.innerWidth - MENU_WIDTH_PX - 8) });
  };
  const keepFocus = (event: React.MouseEvent) => event.preventDefault();

  const lastRow = block.rows[block.rows.length - 1];
  const lastColumn = block.columns[block.columns.length - 1];

  return (
    <div data-table-block className="group/table relative min-w-0 py-2">
      {confirmingDelete ? (
        <span className="absolute -top-1 right-0 z-10 flex items-center gap-1">
          <button type="button" className="h-5 rounded-control bg-danger px-2 text-xs font-semibold text-paper" onClick={onDelete}>삭제</button>
          <button type="button" className={BUTTON} onClick={() => setConfirmingDelete(false)}>취소</button>
        </span>
      ) : (
        <button type="button" className={`absolute -top-1 right-0 z-10 h-5 ${BUTTON} ${REVEAL}`} onClick={() => setConfirmingDelete(true)}>표 삭제</button>
      )}
      <div className="mb-5 mr-5 overflow-x-auto pl-5 pt-5">
        <table aria-label="표" className="w-full border-collapse text-ink">
          <tbody>{block.rows.map((rowId, rowIndex) => (
            <tr key={rowId} data-table-row-id={rowId}>{block.columns.map((columnId, columnIndex) => {
              const key = cellKey(rowId, columnId);
              return (
                <td key={columnId} data-table-column-id={columnId}
                  role={rowIndex === 0 ? "columnheader" : "cell"}
                  className={`relative border border-line px-3 py-2 align-top ${rowIndex === 0 ? "bg-hover font-semibold" : ""}`}
                  style={{ minWidth: 140 }}>
                  {rowIndex === 0 && (
                    <>
                      <button type="button" aria-label={`${columnIndex + 1}열 앞에 열 추가`} className={`${PLUS} -left-2 -top-[18px]`}
                        onMouseDown={keepFocus} onClick={() => add("columns", columnId, true)}>+</button>
                      <button type="button" aria-label={`${columnIndex + 1}열 메뉴`} aria-haspopup="menu" aria-expanded={menu?.id === columnId}
                        className={`${GRIP} -top-2.5 left-1/2 h-1.5 w-8 -translate-x-1/2`}
                        onMouseDown={keepFocus} onClick={(event) => toggleMenu("columns", columnId, event.currentTarget)} />
                    </>
                  )}
                  {columnIndex === 0 && (
                    <>
                      <button type="button" aria-label={`${rowIndex + 1}행 앞에 행 추가`} className={`${PLUS} -left-[18px] -top-2`}
                        onMouseDown={keepFocus} onClick={() => add("rows", rowId, true)}>+</button>
                      <button type="button" aria-label={`${rowIndex + 1}행 메뉴`} aria-haspopup="menu" aria-expanded={menu?.id === rowId}
                        className={`${GRIP} -left-2.5 top-1/2 h-8 w-1.5 -translate-y-1/2`}
                        onMouseDown={keepFocus} onClick={(event) => toggleMenu("rows", rowId, event.currentTarget)} />
                    </>
                  )}
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
      <button type="button" aria-label="오른쪽 끝에 열 추가" className={`${EDGE} bottom-7 right-0 top-7 w-4`}
        onMouseDown={keepFocus} onClick={() => add("columns", lastColumn, false)}>+</button>
      <button type="button" aria-label="아래쪽 끝에 행 추가" className={`${EDGE} bottom-2 left-5 right-5 h-4`}
        onMouseDown={keepFocus} onClick={() => add("rows", lastRow, false)}>+</button>
      {menu && (
        <div ref={menuRef} role="menu" aria-label={`${menu.axis === "rows" ? "행" : "열"} 작업`}
          style={{ top: menu.top, left: menu.left, width: MENU_WIDTH_PX }}
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setMenu(null); }}
          className="fixed z-40 flex flex-col gap-px rounded-card bg-elev p-1 shadow-elev">
          {MENU_ITEMS[menu.axis].map((item) => (
            <button key={item.label} type="button" role="menuitem" className={MENU_ITEM}
              onClick={() => { setMenu(null); add(menu.axis, menu.id, item.before); }}>{item.label}</button>
          ))}
          <div className="mx-1.5 my-1 h-px bg-line" />
          <button type="button" role="menuitem" disabled={block[menu.axis].length <= 1}
            className={`${MENU_ITEM} text-danger hover:bg-danger-soft focus:bg-danger-soft disabled:opacity-50`}
            onClick={() => { setMenu(null); removeAxis(menu.axis, menu.id); }}>{DELETE_LABEL[menu.axis]}</button>
        </div>
      )}
    </div>
  );
}
