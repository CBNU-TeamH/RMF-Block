"use client";

import { useState } from "react";

import { KINDS, sharedFiles, type AttachmentKind } from "@/lib/chat/attachments";
import type { ChatMessage } from "@/lib/chat/types";
import { isInlineType } from "@/lib/files/serving";
import { readableSize } from "@/lib/files/size";

import { useFloatingViews } from "./floating-views";
import { FileIcon } from "./ui";

/** The chat file list (UC-061, FR-061-01..04) — a prototype, like the panel. */

const LABEL: Record<AttachmentKind, string> = { image: "이미지", pdf: "PDF", document: "문서" };

const when = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  // Pinned for the same reason `chat-message.tsx` pins its own.
  timeZone: "Asia/Seoul",
});

export function ChatFiles({ messages }: { messages: Array<ChatMessage> }) {
  const [kind, setKind] = useState<AttachmentKind>("image");
  const openFloating = useFloatingViews();
  const groups = sharedFiles(messages);
  const files = groups[kind];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="group" aria-label="파일 종류" className="flex flex-none gap-1 px-3 pt-2">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={k === kind}
            onClick={() => setKind(k)}
            className={`rounded-control px-2 py-1 text-[12.5px] font-medium ${
              k === kind ? "bg-sky-soft text-sky-text" : "text-ink-soft hover:bg-hover"
            }`}
          >
            {LABEL[k]} {groups[k].length}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {files.length === 0 ? (
          <p className="pt-8 text-center text-[13px] text-ink-faint">
            공유된 {LABEL[kind]} 파일이 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {files.map(({ messageId, sender, sentAt, attachment }) => (
              <li key={messageId} className="flex items-center gap-2.5 rounded-control px-2 py-1.5 hover:bg-hover">
                <span aria-hidden className="flex size-8 flex-none items-center justify-center rounded-control bg-paper-2 text-ink-soft">
                  <FileIcon />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-ink">{attachment.fileName}</span>
                  <span className="block truncate text-xs text-ink-faint">
                    {LABEL[kind]} · {readableSize(attachment.size)} · {sender} ·{" "}
                    <time dateTime={sentAt}>{when.format(new Date(sentAt))}</time>
                  </span>
                </span>
                {isInlineType(attachment.fileType) ? (
                  <button
                    type="button"
                    onClick={() => openFloating(attachment)}
                    aria-label={`${attachment.fileName} 미리보기`}
                    className="flex-none rounded-control px-1.5 py-0.5 text-xs text-ink-soft hover:bg-paper-2 hover:text-ink"
                  >
                    미리보기
                  </button>
                ) : null}
                <a
                  href={`/api/files/${attachment.fileId}/download`}
                  aria-label={`${attachment.fileName} 내려받기`}
                  className="flex-none rounded-control px-1.5 py-0.5 text-xs text-ink-soft hover:bg-paper-2 hover:text-ink"
                >
                  내려받기
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
