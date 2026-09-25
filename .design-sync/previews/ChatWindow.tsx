import { useEffect, useRef } from "react";
import { ChatWindow, PresenceContext } from "rmf-block";

// Same stand-ins as ChatPanel's preview: history arrives once the socket opens.
const at = (hh: number, mm: number) => new Date(Date.UTC(2026, 8, 24, hh - 9, mm)).toISOString();
const history = [
  { id: "1", sender: "김민지", text: "3시에 회의 시작할게요.", sentAt: at(14, 50) },
  { id: "2", sender: "최태진", text: "네 들어갑니다", sentAt: at(14, 51) },
];
class OfflineSocket extends EventTarget {
  constructor() {
    super();
    setTimeout(() => this.dispatchEvent(new Event("open")));
  }
  close() {}
}
window.WebSocket = OfflineSocket as unknown as typeof WebSocket;
const realFetch = window.fetch.bind(window);
window.fetch = (input, init) =>
  String(input).endsWith("/api/chat") && !init?.method
    ? Promise.resolve(new Response(JSON.stringify(history)))
    : realFetch(input, init);

const presence = {
  status: "active" as const,
  members: [
    { id: "m1", nickname: "김민지", colorTag: "#ef4444" },
    { id: "m3", nickname: "최태진", colorTag: "#a855f7" },
  ],
  client: null, memberId: "m3", isPresenting: false, setPresenting: () => undefined,
};

/** The bottom-right 💬 bar with the window opened over the page. */
export function Open() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Where the window was left, read on open — seeded so it lands in view.
    try {
      window.localStorage.setItem("rmf-chat-window", JSON.stringify({ x: 24, y: 24, width: 320, height: 360 }));
    } catch {}
    ref.current?.querySelector<HTMLButtonElement>("button[aria-expanded]")?.click();
  }, []);
  return (
    <PresenceContext.Provider value={presence}>
      <div ref={ref} className="h-[480px] w-[520px] bg-shell">
        <ChatWindow me="최태진" />
      </div>
    </PresenceContext.Provider>
  );
}
