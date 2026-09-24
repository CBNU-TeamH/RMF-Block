"use client";

import { useEffect, useState } from "react";

import type { Frame, Viewport } from "@/lib/chat/window-frame";

/** Moving and resizing a floating window — the chat window's and every
 *  floating view's. The arithmetic is the caller's `rules`; this is only the
 *  pointer plumbing around it. */

export const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });

/** What a drag does to a frame, and how one is pulled back inside a shrunken
 *  viewport. Keep it stable: it is an effect dependency. */
export type FrameRules<K extends string> = {
  apply: (kind: K, start: Frame, dx: number, dy: number, viewport: Viewport) => Frame;
  fit: (frame: Frame, viewport: Viewport) => Frame;
};

type Gesture<K extends string> = {
  kind: K;
  pointerX: number;
  pointerY: number;
  start: Frame;
};

/** `onEnd` gets the frame a gesture left behind — once per drag, not per move. */
export function useFrameGesture<K extends string>(
  frame: Frame | null,
  setFrame: React.Dispatch<React.SetStateAction<Frame | null>>,
  onEnd: (frame: Frame) => void,
  rules: FrameRules<K>,
) {
  // State rather than a ref: it changes only when a gesture starts or ends,
  // never per pointer move, and the effect below depending on it is what
  // attaches and removes the listeners.
  const [gesture, setGesture] = useState<Gesture<K> | null>(null);

  // Listeners go on the window, not the header: a pointer moving faster than
  // React re-renders leaves the element behind, and a drag that stops when the
  // cursor outruns the title bar is a drag that feels broken.
  useEffect(() => {
    if (!gesture) return undefined;

    // A PDF `<iframe>` under the pointer would take the moves and stall the
    // gesture — `docs/design/floating-view.md`, "Moving and resizing".
    const frames = Array.from(document.querySelectorAll("iframe"));
    frames.forEach((frame) => (frame.style.pointerEvents = "none"));

    // The last frame this gesture produced, so `end` can hand it on without
    // calling out from inside a state updater — `onEnd` may set a parent's state.
    let last: Frame | null = null;

    const follow = (event: PointerEvent) => {
      last = rules.apply(
        gesture.kind,
        gesture.start,
        event.clientX - gesture.pointerX,
        event.clientY - gesture.pointerY,
        viewport(),
      );
      setFrame(last);
    };

    // The release point counts too: a fast drag can let go before its last
    // move was delivered, and the window would stop short of the pointer.
    const end = (event: PointerEvent) => {
      setGesture(null);
      const moved = event.clientX !== gesture.pointerX || event.clientY !== gesture.pointerY;
      if (moved) follow(event);
      // A click that never moved has nothing to save.
      if (last) onEnd(last);
    };

    window.addEventListener("pointermove", follow);
    window.addEventListener("pointerup", end);

    return () => {
      window.removeEventListener("pointermove", follow);
      frames.forEach((frame) => (frame.style.pointerEvents = ""));
      window.removeEventListener("pointerup", end);
    };
  }, [gesture, setFrame, onEnd, rules]);

  // A viewport that shrank below the window leaves it partly unreachable.
  useEffect(() => {
    const onResize = () =>
      setFrame((current) => (current ? rules.fit(current, viewport()) : current));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [setFrame, rules]);

  return (kind: K) => (event: React.PointerEvent) => {
    if (!frame) return;
    event.preventDefault();
    setGesture({ kind, pointerX: event.clientX, pointerY: event.clientY, start: frame });
  };
}
