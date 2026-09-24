"use client";

import { useCallback, useState } from "react";

import { BAR_HEIGHT, clamp, defaultFrame, parseFrame, type Frame } from "@/lib/chat/window-frame";

import { ChatPanel } from "./chat-panel";
import { FloatingFrame } from "./floating-frame";
import { useFrameGesture, viewport } from "./use-frame-gesture";

/** The chat window and the bar that opens it. A floating window, not a rail —
 *  where chat wants to sit depends on what is under it. The title bar moves it,
 *  the other three borders resize it; the arithmetic is in
 *  `lib/chat/window-frame.ts` so it checks without a browser. */

/** Where the window was left. `localStorage` because that is what this is — one
 *  viewer's convenience on one device, and the default answers fine when it
 *  throws or comes back empty. */
const STORAGE_KEY = "rmf-chat-window";

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

export function ChatWindow({ me }: { me: string }) {
  const [open, setOpen] = useState(false);
  const [frame, setFrame] = useState<Frame | null>(null);

  // Resolved on first open, not during render: `window` does not exist while
  // this component renders on the server, and neither does the saved frame.
  const openWindow = useCallback(() => {
    setFrame((current) => current ?? clamp(readFrame() ?? defaultFrame(viewport()), viewport()));
    setOpen(true);
  }, []);

  // Saved when the gesture ends rather than on every move — one write per
  // drag instead of one per frame.
  const begin = useFrameGesture(frame, setFrame, writeFrame);

  return (
    <>
      {open && frame ? (
        <FloatingFrame
          frame={frame}
          begin={begin}
          label="채팅"
          title={
            <span className="font-mono text-[10px] tracking-wide text-ink-soft uppercase">
              채팅
            </span>
          }
          closeLabel="채팅 닫기"
          onClose={() => setOpen(false)}
          className="z-40"
          headerClassName="bg-paper-2"
        >
          <ChatPanel me={me} />
        </FloatingFrame>
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
