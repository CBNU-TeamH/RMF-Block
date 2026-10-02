import { ChatPanel, PresenceContext } from "rmf-block";

// The panel backfills history from the app server once its socket opens.
// Stand in for both so the card shows a conversation.
const at = (hh: number, mm: number) => new Date(Date.UTC(2026, 8, 24, hh - 9, mm)).toISOString();
const history = [
  { id: "1", sender: "김민지", text: "회의록 초안 올려뒀어요. 2절 확인 부탁드립니다.", sentAt: at(14, 2) },
  { id: "2", sender: "최태진", text: "네, 지금 보고 있어요!", sentAt: at(14, 3) },
  { id: "3", sender: "박서준", text: "발표 자료입니다.", sentAt: at(14, 5), attachment: { fileId: "f1", fileName: "중간발표_TeamH.pdf", fileType: "application/pdf", size: 2_483_200 } },
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
    { id: "m2", nickname: "박서준", colorTag: "#22c55e" },
    { id: "m3", nickname: "최태진", colorTag: "#a855f7" },
  ],
  client: null, memberId: "m3", isPresenting: false, setPresenting: () => undefined,
};

/** The chat window's body: history, composer with attach and send. */
export function Conversation() {
  return (
    <PresenceContext.Provider value={presence}>
      <div className="flex h-96 w-80 flex-col border border-ink">
        <ChatPanel me="최태진" />
      </div>
    </PresenceContext.Provider>
  );
}
