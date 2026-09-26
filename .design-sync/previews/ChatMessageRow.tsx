import { ChatMessageRow } from "rmf-block";

const at = (hh: number, mm: number) => new Date(Date.UTC(2026, 8, 24, hh - 9, mm)).toISOString();

export function Conversation() {
  return (
    <ul className="flex w-80 flex-col gap-3 bg-paper p-4">
      <ChatMessageRow
        mine={false}
        colorTag="#ef4444"
        message={{ id: "1", sender: "김민지", text: "회의록 초안 올려뒀어요. 2절 확인 부탁드립니다.", sentAt: at(14, 2) }}
      />
      <ChatMessageRow
        mine
        colorTag="#3b82f6"
        message={{ id: "2", sender: "이하은", text: "네, 지금 보고 있어요!", sentAt: at(14, 3) }}
      />
      <ChatMessageRow
        mine={false}
        colorTag="#22c55e"
        message={{ id: "3", sender: "박서준", text: "표 부분은 제가 정리할게요.\n오늘 안에 끝낼게요.", sentAt: at(14, 5) }}
      />
    </ul>
  );
}

export function FileAttachment() {
  return (
    <ul className="flex w-80 flex-col gap-3 bg-paper p-4">
      <ChatMessageRow
        mine={false}
        colorTag="#a855f7"
        message={{
          id: "4",
          sender: "최태진",
          text: "발표 자료입니다.",
          sentAt: at(15, 40),
          attachment: { fileId: "f1", fileName: "중간발표_TeamH.pdf", fileType: "application/pdf", size: 2_483_200 },
        }}
      />
    </ul>
  );
}

/** A sender the roster doesn't know gets the neutral paper-2 badge. */
export function UnknownSender() {
  return (
    <ul className="flex w-80 flex-col gap-3 bg-paper p-4">
      <ChatMessageRow
        mine={false}
        colorTag={undefined}
        message={{ id: "5", sender: "게스트", text: "들어왔습니다 👋", sentAt: at(9, 15) }}
      />
    </ul>
  );
}
