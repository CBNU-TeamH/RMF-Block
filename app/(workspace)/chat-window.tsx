"use client";

import { createContext, useCallback, useContext, useState } from "react";

import type { ChatLinkRequest } from "@/lib/chat/types";
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
import { FloatingFrame } from "./floating-frame";
import { useFrameGesture, viewport, type FrameRules } from "./use-frame-gesture";

/** The chat window and the bar that opens it. A floating window, not a rail —
 *  where chat wants to sit depends on what is under it. The title bar moves it,
 *  the other three borders resize it; the arithmetic is in
 *  `lib/chat/window-frame.ts` so it checks without a browser. */

/** Where the window was left. `localStorage` because that is what this is — one
 *  viewer's convenience on one device, and the default answers fine when it
 *  throws or comes back empty. */
const STORAGE_KEY = "rmf-chat-window";

const RULES: FrameRules<GestureKind> = { apply: applyGesture, fit: clamp };

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

/** Opens the window at a message (UC-050 E3-3) — what the file manager needs. */
const OpenChatAtContext = createContext<(messageId: string) => void>(() => undefined);
export const useOpenChatAt = () => useContext(OpenChatAtContext);

/** Opens the window with a link attached to the next message (FR-060-03) —
 *  the editor's 채팅으로 보내기. */
const SendToChatContext = createContext<(link: ChatLinkRequest) => void>(() => undefined);
export const useSendToChat = () => useContext(SendToChatContext);

/** Wraps the shell so anything in it can open the window at a message, or with
 *  a link attached. */
export function ChatWindow({
  me,
  documents,
  children,
}: {
  me: string;
  /** The layout's catalogue, for a link's current name and whether it is gone. */
  documents: Array<{ id: string; name: string }>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [landOn, setLandOn] = useState<string | null>(null);
  // The link waiting for the next message. Here rather than in the panel, so it
  // outlives the window being closed.
  const [link, setLink] = useState<ChatLinkRequest | null>(null);

  // Resolved on first open, not during render: `window` does not exist while
  // this component renders on the server, and neither does the saved frame.
  const openWindow = useCallback(() => {
    setFrame((current) => current ?? clamp(readFrame() ?? defaultFrame(viewport()), viewport()));
    setOpen(true);
  }, []);
  const openAt = useCallback(
    (messageId: string) => {
      setLandOn(messageId);
      openWindow();
    },
    [openWindow],
  );
  const landed = useCallback(() => setLandOn(null), []);
  const sendToChat = useCallback(
    (next: ChatLinkRequest) => {
      setLink(next);
      openWindow();
    },
    [openWindow],
  );

  // Saved when the gesture ends rather than on every move — one write per
  // drag instead of one per frame.
  const begin = useFrameGesture(frame, setFrame, writeFrame, RULES);

  return (
    <OpenChatAtContext.Provider value={openAt}>
      <SendToChatContext.Provider value={sendToChat}>
        {children}
        {open && frame ? (
          <FloatingFrame
            frame={frame}
            begin={begin}
            label="채팅"
            title={
              <span className="text-[13px] font-semibold text-ink">채팅</span>
            }
            resize="edges"
            closeLabel="채팅 닫기"
            onClose={() => setOpen(false)}
            className="z-40"
          >
            <ChatPanel me={me} documents={documents} link={link} onLink={setLink} landOn={landOn} onLanded={landed} />
          </FloatingFrame>
        ) : null}

        {/* The height here is the same number `window-frame` keeps the window
            clear of. A Tailwind class would be a second place to change it, and
            the two drifting apart is exactly how the window ends up covering the
            button that opens it. */}
        <div
          style={{ height: BAR_HEIGHT }}
          className="fixed right-3 bottom-0 z-30 flex items-center"
        >
          <button
            type="button"
            onClick={() => (open ? setOpen(false) : openWindow())}
            aria-expanded={open}
            className={`flex h-8 items-center gap-1.5 rounded-control px-3 text-[13.5px] font-medium shadow-elev ${
              open ? "bg-sky-soft text-sky-text" : "bg-elev text-ink-soft hover:text-ink"
            }`}
          >
            <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round">
              <path d="M3 3.5h10v7H7l-3 2.5v-2.5H3z" />
            </svg>
            채팅
          </button>
        </div>
      </SendToChatContext.Provider>
    </OpenChatAtContext.Provider>
  );
}
