"use client";

import { useEffect, useRef, useState } from "react";

export type RowMenuItem = {
  label: string;
  /** A 15px glyph drawn in `currentColor` before the label. */
  icon?: React.ReactNode;
  onSelect: () => void;
  /** Drawn apart from the rest, below a rule. For the one that cannot be undone. */
  danger?: boolean;
};

/** Roughly what the menu occupies, used only to decide whether it opens downward or up.
 *  An estimate rather than a measurement: measuring needs the menu mounted, and
 *  a first paint in the wrong place is exactly the flicker this avoids. Being a
 *  little wrong costs a menu that opens upward with room to spare. */
const MENU_HEIGHT_PX = 150;
const MENU_WIDTH_PX = 220;

/**
 * A sidebar tree row's ··· overflow menu (`docs/ui/redesign/HANDOFF.md` §3).
 *
 * **Why `position: fixed` rather than absolute.** The tree scrolls inside the
 * sidebar, so a menu positioned against the row would be clipped by that
 * scroller — the last rows worst, which is where a document-tree menu is most
 * often used. Fixed coordinates read off the button's own rect escape the clip.
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
        className={`flex size-[22px] items-center justify-center rounded text-ink-faint hover:bg-sky-soft hover:text-ink ${
          open ? "bg-sky-soft text-ink" : ""
        }`}
      >
        <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="3.5" cy="8" r="1.2" />
          <circle cx="8" cy="8" r="1.2" />
          <circle cx="12.5" cy="8" r="1.2" />
        </svg>
      </button>

      {at ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`${label} 작업`}
          style={{ top: at.top, left: at.left, width: MENU_WIDTH_PX }}
          className="fixed z-40 flex flex-col gap-px rounded-card bg-elev p-1 shadow-elev"
        >
          {items.map((item) => (
            <div key={item.label}>
              {item.danger ? <div className="mx-1.5 my-1 h-px bg-line" /> : null}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setAt(null);
                  item.onSelect();
                }}
                className={`flex h-[30px] w-full items-center gap-2.5 rounded-control px-2 text-left text-[14px] ${
                  item.danger
                    ? "text-danger hover:bg-danger-soft focus:bg-danger-soft"
                    : "text-ink hover:bg-hover focus:bg-hover [&>svg]:text-ink-soft"
                } outline-none focus-visible:ring-2 focus-visible:ring-sky-deep focus-visible:ring-inset`}
              >
                {item.icon}
                {item.label}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
