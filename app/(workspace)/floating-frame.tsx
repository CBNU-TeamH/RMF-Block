"use client";

import type { Frame, GestureKind } from "@/lib/chat/window-frame";

/** The three resize borders. Invisible and found by the cursor changing, like a
 *  desktop window's — and wider than the 1px they sit on, because a border you
 *  have to hit precisely is a border you miss. */
const BORDERS: Array<{ kind: GestureKind; className: string }> = [
  { kind: "left", className: "top-8 bottom-0 left-0 w-1.5 cursor-ew-resize" },
  { kind: "right", className: "top-8 right-0 bottom-0 w-1.5 cursor-ew-resize" },
  { kind: "bottom", className: "right-0 bottom-0 left-0 h-1.5 cursor-ns-resize" },
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
  closeClassName = "text-ink-faint",
  onClose,
  className,
  headerClassName,
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
  headerClassName: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={label}
      style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
      className={`fixed flex flex-col overflow-hidden rounded-lg border border-ink bg-paper shadow-[0_6px_24px_rgba(28,27,26,0.18)] ${className}`}
    >
      <header
        onPointerDown={begin("move")}
        className={`flex h-8 flex-none cursor-move touch-none items-center gap-2 border-b border-ink px-2.5 select-none ${headerClassName}`}
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
          className={`px-1 text-[13px] leading-none ${closeClassName}`}
        >
          ✕
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
            className={`absolute touch-none ${border.className}`}
          />
        ))
      ) : (
        <span
          onPointerDown={begin("corner")}
          aria-hidden
          className="absolute right-0 bottom-0 size-3.5 cursor-nwse-resize touch-none border-r-2 border-b-2 border-ink-faint"
        />
      )}
    </section>
  );
}
