"use client";

import { useCallback, useEffect, useState } from "react";

import {
  applyGesture,
  clamp,
  defaultFrame,
  parseFrame,
  type Frame,
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
  kind: "move" | "resize";
  pointerX: number;
  pointerY: number;
  start: Frame;
};

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
              onClick={() => setOpen(false)}
              aria-label="채팅 닫기"
              className="px-1 text-[13px] leading-none text-ink-faint"
            >
              ✕
            </button>
          </header>

          <ChatPanel me={me} />

          {/* Pointer-only, and marked as such: resizing is a drag, and there is
              no keyboard equivalent yet. */}
          <span
            onPointerDown={begin("resize")}
            aria-hidden
            className="absolute right-0 bottom-0 size-4 cursor-nwse-resize touch-none bg-[repeating-linear-gradient(135deg,transparent_0_2px,var(--color-ink-faint)_2px_3px)]"
          />
        </section>
      ) : null}

      <div className="fixed right-0 bottom-0 z-30 flex h-10 items-center border-t border-l border-ink bg-paper px-3">
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
