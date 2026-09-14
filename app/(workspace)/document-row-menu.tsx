"use client";

import { useEffect, useRef, useState } from "react";

export type RowMenuItem = {
  label: string;
  onSelect: () => void;
  /** Drawn apart from the rest, below a rule. For the one that cannot be undone. */
  danger?: boolean;
};

/** Roughly what the menu occupies, used only to decide whether it opens downward or up.
 *  An estimate rather than a measurement: measuring needs the menu mounted, and
 *  a first paint in the wrong place is exactly the flicker this avoids. Being a
 *  little wrong costs a menu that opens upward with room to spare. */
const MENU_HEIGHT_PX = 160;
const MENU_WIDTH_PX = 168;

/**
 * The row's ⋯ overflow menu — the control `docs/ui/dashboard/dashboard.dc.html`
 * has always had in its last column, and the reason that column is 30px wide.
 *
 * **Why `position: fixed` rather than absolute.** The list sits inside
 * `overflow-hidden` (it is what rounds the table's corners), so a menu
 * positioned against the row would be clipped — the last rows worst, which is
 * where a document-tree menu is most often used. Fixed coordinates read off the
 * button's own rect escape the clip without unpicking the border radius.
 *
 * The cost of that choice is that the menu does not travel with a scroll, so it
 * closes on one. That is what a menu anchored to something that moved should do
 * anyway; repositioning mid-scroll is motion nobody asked for.
 *
 * The trap `fixed` brings with it: a `transform` on **any** ancestor makes that
 * ancestor the containing block, and these coordinates then mean something
 * other than the viewport. The caller centres its wrapper with flex for this
 * reason — measured, after a `-translate-y-1/2` put the menu 49px too high.
 */
export function DocumentRowMenu({ label, items }: { label: string; items: Array<RowMenuItem> }) {
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const open = at !== null;

  useEffect(() => {
    if (!open) return;

    // `pointerdown`, not `click`: a click that lands on another row's ⋯ should
    // close this one and open that one, and `click` fires too late for the
    // second half of that to be the same gesture.
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setAt(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setAt(null);
      // Focus goes back where it came from, or it lands on <body> and the next
      // Tab restarts at the top of the page.
      buttonRef.current?.focus();
    };
    const onScroll = () => setAt(null);

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    // Capture, so a scroll inside any pane counts, not only the page's own.
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  // Focus the first item once it exists, so the menu is usable without a mouse.
  useEffect(() => {
    if (open) menuRef.current?.querySelector("button")?.focus();
  }, [open]);

  function toggle() {
    if (open) {
      setAt(null);
      return;
    }

    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Open upward when there isn't room below — the last row of a long list is
    // exactly where this menu is reached for most often.
    const below = window.innerHeight - rect.bottom;
    setAt({
      top: below < MENU_HEIGHT_PX ? rect.top - MENU_HEIGHT_PX : rect.bottom + 4,
      left: Math.max(8, rect.right - MENU_WIDTH_PX),
    });
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`${label} 메뉴`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        // Faint until the row is hovered or something in it has focus, then
        // full strength — present enough to be discovered, quiet enough that a
        // long list does not read as a column of dots.
        className={`rounded-md px-1 text-[15px] leading-none text-ink-faint hover:bg-paper-2 hover:text-ink group-hover/row:text-ink-soft group-focus-within/row:text-ink-soft ${
          open ? "bg-paper-2 text-ink" : ""
        }`}
      >
        ⋯
      </button>

      {at ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`${label} 작업`}
          style={{ top: at.top, left: at.left, width: MENU_WIDTH_PX }}
          className="fixed z-40 rounded-lg border border-ink bg-paper py-1 shadow-lg"
        >
          {items.map((item) => (
            <div key={item.label}>
              {item.danger ? <div className="my-1 border-t border-ink/15" /> : null}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setAt(null);
                  item.onSelect();
                }}
                className={`block w-full px-3 py-1.5 text-left text-[13px] hover:bg-paper-2 ${
                  item.danger ? "text-red-600" : "text-ink"
                }`}
              >
                {item.label}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
