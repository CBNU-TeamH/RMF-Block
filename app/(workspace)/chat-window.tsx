"use client";

import { useCallback, useEffect, useState } from "react";

import {
  BAR_HEIGHT,
  applyGesture,
  clamp,
  defaultFrame,
  parseFrame,
  type Frame,
  type GestureKind,
} from "@/lib/chat/window-frame";

import { ChatPanel } from "./chat-panel";

/**
 * The chat window and the bar that opens it.
 *
 * A floating window rather than a rail down the side of the shell: the
 * workspace screen is for the documents, and chat is something you pull up
 * beside them and push out of the way again. It drags and resizes for the same
 * reason — where it wants to sit depends on what is underneath it.
 *
 * It is driven like a desktop window: the title bar moves it, and its left,
 * right and bottom borders resize it. There is no top border to pull, because
 * that edge is the title bar.
 *
 * All the arithmetic — the default ninth-of-the-viewport placement, the minimum
 * size, staying reachable — is in `lib/chat/window-frame.ts` so it can be
 * checked without a browser. This file is the pointer plumbing and the markup.
 *
 * **Prototype.** No artboard covers this; it borrows the shell's tokens the way
 * the panel inside it does.
 */

/**
 * Where the window was left. Persisted so closing and reopening brings it back
 * as it was rather than snapping to the default — the placement is a decision
 * the person made, and making them make it again every time is the annoyance
 * this remembers away.
 *
 * `localStorage` because that is exactly what this is: one viewer's
 * convenience, on one device, worth nothing to anyone else. It can throw or
 * come back empty — a private window, cleared data — and the default is a
 * perfectly good answer when it does.
 */
const STORAGE_KEY = "rmf-chat-window";

const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });

function readFrame(): Frame | null {
  try {
    return parseFrame(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeFrame(frame: Frame): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(frame));
  } catch {
    // Storage can be unavailable or full. The window still works; it just
    // starts from the default next time.
  }
}

type Gesture = {
  kind: GestureKind;
  pointerX: number;
  pointerY: number;
  start: Frame;
};

/**
 * The three borders that resize the window.
 *
 * Invisible, and found by the cursor changing over them, exactly as a desktop
 * window's borders are. They are wider than the 1px they sit on because a
 * border you have to hit precisely is a border you miss.
 */
const BORDERS: Array<{ kind: GestureKind; className: string }> = [
  { kind: "left", className: "top-8 bottom-0 left-0 w-1.5 cursor-ew-resize" },
  { kind: "right", className: "top-8 right-0 bottom-0 w-1.5 cursor-ew-resize" },
  { kind: "bottom", className: "right-0 bottom-0 left-0 h-1.5 cursor-ns-resize" },
];

export function ChatWindow({ me }: { me: string }) {
  const [open, setOpen] = useState(false);
  const [frame, setFrame] = useState<Frame | null>(null);

  // State rather than a ref: it changes only when a gesture starts or ends,
  // never per pointer move, and the effect below depending on it is what
  // attaches and removes the listeners.
  const [gesture, setGesture] = useState<Gesture | null>(null);

  // Resolved on first open, not during render: `window` does not exist while
  // this component renders on the server, and neither does the saved frame.
  const openWindow = useCallback(() => {
    setFrame((current) => current ?? clamp(readFrame() ?? defaultFrame(viewport()), viewport()));
    setOpen(true);
  }, []);

  // Listeners go on the window, not the header: a pointer moving faster than
  // React re-renders leaves the element behind, and a drag that stops when the
  // cursor outruns the title bar is a drag that feels broken.
  useEffect(() => {
    if (!gesture) return undefined;

    const move = (event: PointerEvent) =>
      setFrame(
        applyGesture(
          gesture.kind,
          gesture.start,
          event.clientX - gesture.pointerX,
          event.clientY - gesture.pointerY,
          viewport(),
        ),
      );

    // Saved when the gesture ends rather than on every move — one write per
    // drag instead of one per frame.
    const end = () => {
      setGesture(null);
      setFrame((current) => {
        if (current) writeFrame(current);
        return current;
      });
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);

    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
  }, [gesture]);

  // A viewport that shrank below the window leaves it partly unreachable.
  useEffect(() => {
    const onResize = () =>
      setFrame((current) => (current ? clamp(current, viewport()) : current));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const begin = (kind: Gesture["kind"]) => (event: React.PointerEvent) => {
    if (!frame) return;
    event.preventDefault();
    setGesture({ kind, pointerX: event.clientX, pointerY: event.clientY, start: frame });
  };

  return (
    <>
      {open && frame ? (
        <section
          aria-label="채팅"
          style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
          className="fixed z-40 flex flex-col overflow-hidden rounded-lg border border-ink bg-paper shadow-[0_6px_24px_rgba(28,27,26,0.18)]"
        >
          <header
            onPointerDown={begin("move")}
            className="flex h-8 flex-none cursor-move touch-none items-center gap-2 border-b border-ink bg-paper-2 px-2.5 select-none"
          >
            <span className="font-mono text-[10px] tracking-wide text-ink-soft uppercase">
              채팅
            </span>
            <span className="flex-1" />
            <button
              type="button"
              // The button sits inside the header, so its pointerdown would
              // bubble into `begin("move")` and start a drag. Release without
              // moving and the click still closes; twitch first and the window
              // has been moved and the new frame saved, by a control that is
              // not for moving it.
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setOpen(false)}
              aria-label="채팅 닫기"
              className="px-1 text-[13px] leading-none text-ink-faint"
            >
              ✕
            </button>
          </header>

          <ChatPanel me={me} />

          {/* Pointer-only, and marked as such: dragging a border has no keyboard
              equivalent yet. They come after the panel so they sit above it —
              the border must win the pointer, not the message list under it. */}
          {BORDERS.map((border) => (
            <span
              key={border.kind}
              onPointerDown={begin(border.kind)}
              aria-hidden
              className={`absolute touch-none ${border.className}`}
            />
          ))}
        </section>
      ) : null}

      {/* The height here is the same number `window-frame` keeps the window
          clear of. A Tailwind class would be a second place to change it, and
          the two drifting apart is exactly how the window ends up covering the
          button that opens it. */}
      <div
        style={{ height: BAR_HEIGHT }}
        className="fixed right-0 bottom-0 z-30 flex items-center border-t border-l border-ink bg-paper px-3"
      >
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openWindow())}
          aria-expanded={open}
          className={`rounded px-2 py-1 font-mono text-[10px] tracking-wide uppercase ${
            open ? "bg-sky-soft font-bold text-ink" : "text-ink-soft"
          }`}
        >
          💬 채팅
        </button>
      </div>
    </>
  );
}
