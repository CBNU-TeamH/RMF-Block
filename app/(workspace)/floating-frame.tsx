"use client";

import type { Frame, GestureKind } from "@/lib/chat/window-frame";

/** The three resize borders. Invisible and found by the cursor changing, like a
 *  desktop window's — and wider than the 1px they sit on, because a border you
 *  have to hit precisely is a border you miss. */
const BORDERS: Array<{ kind: GestureKind; className: string }> = [
  { kind: "left", className: "top-9 bottom-0 left-0 w-1.5 cursor-ew-resize after:left-0 after:inset-y-3 after:w-[3px]" },
  { kind: "right", className: "top-9 right-0 bottom-0 w-1.5 cursor-ew-resize after:right-0 after:inset-y-3 after:w-[3px]" },
  { kind: "bottom", className: "right-0 bottom-0 left-0 h-1.5 cursor-ns-resize after:bottom-0 after:inset-x-3 after:h-[3px]" },
];

/** The chrome every floating window shares — the chat window and each floating
 *  view: a title bar that moves it, a close button, and either three resize
 *  borders or one corner grip. */
export function FloatingFrame({
  frame,
  begin,
  resize,
  label,
  title,
  closeLabel,
  closeClassName = "text-ink-faint hover:text-ink",
  onClose,
  className,
  children,
}: {
  frame: Frame;
  /** A method, so a caller whose hook only knows its own kinds still fits. */
  begin(kind: GestureKind | "corner"): (event: React.PointerEvent) => void;
  /** `edges` for a free window, `corner` for one that keeps its ratio. */
  resize: "edges" | "corner";
  label: string;
  title: React.ReactNode;
  closeLabel: string;
  closeClassName?: string;
  onClose: () => void;
  /** Stacking and anything else only this window wants on its frame. */
  className: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={label}
      style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
      // The ring marks the window you're working in (HANDOFF's "active window").
      className={`fixed flex flex-col overflow-hidden rounded-card bg-elev shadow-elev focus-within:shadow-[0_0_0_2px_var(--color-sky-ring),var(--shadow-elev)] ${className}`}
    >
      <header
        onPointerDown={begin("move")}
        className="flex h-9 flex-none cursor-grab touch-none items-center gap-2 border-b border-line pr-1.5 pl-3 select-none active:cursor-grabbing"
      >
        {title}
        <span className="flex-1" />
        <button
          type="button"
          // Inside the header, so pointerdown would bubble into
          // `begin("move")` — a twitch would move and save the window from a
          // control that is not for moving it.
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClose}
          aria-label={closeLabel}
          className={`flex size-[26px] items-center justify-center rounded-control hover:bg-hover ${closeClassName}`}
        >
          <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </header>

      {children}

      {/* Pointer-only, and marked as such: dragging a border has no keyboard
          equivalent yet. They come after the content so they sit above it —
          the border must win the pointer, not what is under it. */}
      {resize === "edges" ? (
        BORDERS.map((border) => (
          <span
            key={border.kind}
            onPointerDown={begin(border.kind)}
            aria-hidden
            // A 3px sky bar on hover shows which edge will move.
            className={`absolute touch-none after:absolute after:rounded-full after:bg-sky-deep after:opacity-0 after:transition-opacity after:duration-[120ms] hover:after:opacity-100 ${border.className}`}
          />
        ))
      ) : (
        <span
          onPointerDown={begin("corner")}
          aria-hidden
          className="absolute right-1 bottom-1 size-3 cursor-nwse-resize touch-none rounded-br-[3px] border-r-2 border-b-2 border-line-strong hover:border-sky-deep"
        />
      )}
    </section>
  );
}
