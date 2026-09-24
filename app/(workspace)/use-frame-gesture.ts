"use client";

import { useEffect, useState } from "react";

import { applyGesture, clamp, type Frame, type GestureKind } from "@/lib/chat/window-frame";

/** Moving and resizing a floating window — the chat window's and every
 *  floating view's. The arithmetic is `lib/chat/window-frame.ts`'s; this is only
 *  the pointer plumbing around it. */

export const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });

type Gesture = {
  kind: GestureKind;
  pointerX: number;
  pointerY: number;
  start: Frame;
};

/** The three resize borders. Invisible and found by the cursor changing, like a
 *  desktop window's — and wider than the 1px they sit on, because a border you
 *  have to hit precisely is a border you miss. */
export const BORDERS: Array<{ kind: GestureKind; className: string }> = [
  { kind: "left", className: "top-8 bottom-0 left-0 w-1.5 cursor-ew-resize" },
  { kind: "right", className: "top-8 right-0 bottom-0 w-1.5 cursor-ew-resize" },
  { kind: "bottom", className: "right-0 bottom-0 left-0 h-1.5 cursor-ns-resize" },
];

/** `onEnd` gets the frame a gesture left behind — once per drag, not per move. */
export function useFrameGesture(
  frame: Frame | null,
  setFrame: React.Dispatch<React.SetStateAction<Frame | null>>,
  onEnd: (frame: Frame) => void,
) {
  // State rather than a ref: it changes only when a gesture starts or ends,
  // never per pointer move, and the effect below depending on it is what
  // attaches and removes the listeners.
  const [gesture, setGesture] = useState<Gesture | null>(null);

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

    const end = () => {
      setGesture(null);
      setFrame((current) => {
        if (current) onEnd(current);
        return current;
      });
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);

    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
  }, [gesture, setFrame, onEnd]);

  // A viewport that shrank below the window leaves it partly unreachable.
  useEffect(() => {
    const onResize = () =>
      setFrame((current) => (current ? clamp(current, viewport()) : current));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [setFrame]);

  return (kind: GestureKind) => (event: React.PointerEvent) => {
    if (!frame) return;
    event.preventDefault();
    // Captured, so an `<iframe>` under the pointer — a floating PDF — cannot
    // swallow the moves and strand the drag.
    event.currentTarget.setPointerCapture(event.pointerId);
    setGesture({ kind, pointerX: event.clientX, pointerY: event.clientY, start: frame });
  };
}
