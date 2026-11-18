"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { BlockId } from "@/lib/blocks/types";

type Range = { anchor: BlockId; focus: BlockId };

const sameRange = (a: Range | null, b: Range | null) => a?.anchor === b?.anchor && a?.focus === b?.focus;
/** A state update that keeps the current range when nothing changed, so a drag re-renders only on a new block. */
const keep = (next: Range | null) => (current: Range | null) => (sameRange(current, next) ? current : next);

/** Whole-block selection, its copy and its delete: `docs/design/document-editing.md`,
 *  "Selecting and copying blocks". */
export function useBlockSelection({
  order,
  listRef,
  markdownOf,
  focusText,
  deleteBlocks,
}: {
  order: Array<BlockId>;
  /** Holds the block rows: elements with `data-block-id`. */
  listRef: React.RefObject<HTMLElement | null>;
  /** Read at copy time, so the text is what the document holds then. */
  markdownOf: (ids: Set<BlockId>) => string;
  focusText: (blockId: BlockId) => void;
  deleteBlocks: (ids: Set<BlockId>) => void;
}) {
  const [range, setRange] = useState<Range | null>(null);
  // The window listeners below are attached once and read these.
  const rangeRef = useRef<Range | null>(null);
  useEffect(() => {
    rangeRef.current = range;
  }, [range]);
  const dragStartRef = useRef<BlockId | null>(null);
  const proxyRef = useRef<HTMLTextAreaElement | null>(null);

  const selected = useMemo(() => {
    if (!range) return null;
    const anchor = order.indexOf(range.anchor);
    const focus = order.indexOf(range.focus);
    if (anchor < 0 || focus < 0) return null;
    return new Set(order.slice(Math.min(anchor, focus), Math.max(anchor, focus) + 1));
  }, [order, range]);

  const blockAt = useCallback(
    (target: EventTarget | Element | null): BlockId | null => {
      const row = target instanceof Element ? target.closest("[data-block-id]") : null;
      return row && listRef.current?.contains(row) ? row.getAttribute("data-block-id") : null;
    },
    [listRef],
  );

  const select = useCallback((next: Range) => {
    setRange(keep(next));
    proxyRef.current?.focus({ preventScroll: true });
  }, []);

  const selectAll = useCallback(() => {
    const first = order[0];
    const last = order[order.length - 1];
    if (first !== undefined && last !== undefined) select({ anchor: first, focus: last });
  }, [order, select]);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      // A control that acts on the selection (the float button) keeps it, and
      // keeps focus here so the blur below does not end it either.
      if (rangeRef.current && event.target instanceof Element && event.target.closest("[data-selection-action]")) {
        event.preventDefault();
        return;
      }
      const id = blockAt(event.target);
      if (id && event.shiftKey) {
        const anchor = rangeRef.current?.anchor ?? blockAt(document.activeElement);
        if (anchor && anchor !== id) {
          // Before the textarea under the pointer takes focus and a text selection.
          event.preventDefault();
          select({ anchor, focus: id });
          return;
        }
      }
      setRange(null);
      dragStartRef.current = id;
    };

    const onMouseMove = (event: MouseEvent) => {
      const start = dragStartRef.current;
      if (start === null || (event.buttons & 1) === 0) return;
      const id = blockAt(document.elementFromPoint(event.clientX, event.clientY));
      if (id !== null) setRange(keep(id === start ? null : { anchor: start, focus: id }));
    };

    const onMouseUp = () => {
      const start = dragStartRef.current;
      dragStartRef.current = null;
      if (start === null || rangeRef.current === null) return;
      // The drag also selected text inside the block it started in.
      const active = document.activeElement;
      if (active instanceof HTMLTextAreaElement) active.setSelectionRange(active.selectionStart, active.selectionStart);
      proxyRef.current?.focus({ preventScroll: true });
    };

    // A drag handle or an image starts a native drag, which ends without a mouseup.
    const onDragStart = () => {
      dragStartRef.current = null;
    };

    window.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("dragstart", onDragStart, true);
    return () => {
      window.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("dragstart", onDragStart, true);
    };
  }, [blockAt, select]);

  // Selected text, so Ctrl/Cmd+C is the browser's own copy and fires `copy`.
  useLayoutEffect(() => {
    const proxy = proxyRef.current;
    if (!proxy) return;
    proxy.value = selected ? `블록 ${selected.size}개` : "";
    if (document.activeElement === proxy) proxy.select();
  }, [selected]);

  const proxyProps = {
    ref: proxyRef,
    "aria-label": "선택한 블록",
    readOnly: true,
    tabIndex: -1,
    defaultValue: "",
    className: "pointer-events-none fixed top-0 left-0 size-px opacity-0",
    onFocus: (event: React.FocusEvent<HTMLTextAreaElement>) => event.currentTarget.select(),
    onBlur: (event: React.FocusEvent<HTMLTextAreaElement>) => {
      // Focus moving to another control ends the selection; the window losing
      // focus (switching apps to paste) does not.
      if (event.relatedTarget) setRange(null);
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setRange(null);
        if (range) focusText(range.focus);
      } else if ((event.key === "Backspace" || event.key === "Delete") && selected) {
        event.preventDefault();
        setRange(null);
        deleteBlocks(selected);
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "x" && selected) {
        // Cut is `onCopy` below and then the delete — only once the copy landed.
        event.preventDefault();
        if (!document.execCommand("copy")) return;
        setRange(null);
        deleteBlocks(selected);
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        selectAll();
      }
    },
    onCopy: (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!selected) return;
      event.preventDefault();
      event.clipboardData.setData("text/plain", markdownOf(selected));
    },
  };

  return { selected, selectAll, proxyProps };
}
