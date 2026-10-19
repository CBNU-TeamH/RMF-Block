"use client";

import { useCallback, useState } from "react";

import { KINDS, sharedFiles } from "@/lib/chat/attachments";
import { sharedLinks } from "@/lib/chat/links";
import type { ChatMessage } from "@/lib/chat/types";
import { isInlineType } from "@/lib/files/serving";
import { readableSize } from "@/lib/files/size";

import { useOpenLink } from "./chat-message";
import { FilePreviewDialog, type PreviewFile } from "./file-preview-dialog";
import { FileIcon } from "./ui";

/** The chat file list (UC-061, FR-061-01..04) — a prototype, like the panel. */

/** The file kinds, and FR-061-01's links — here only: the file manager shares `KINDS`. */
const TABS = [...KINDS, "link"] as const;
type Tab = (typeof TABS)[number];

const LABEL: Record<Tab, string> = { image: "이미지", pdf: "PDF", document: "문서", link: "링크" };

const ACTION = "flex-none rounded-control px-1.5 py-0.5 text-xs text-ink-soft hover:bg-paper-2 hover:text-ink";

const when = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  // Pinned for the same reason `chat-message.tsx` pins its own.
  timeZone: "Asia/Seoul",
});

export function ChatFiles({
  messages,
  names,
}: {
  messages: Array<ChatMessage>;
  /** Each document's current name: a link's, and whether it is gone. */
  names: Map<string, string>;
}) {
  const [kind, setKind] = useState<Tab>("image");
  const [previewing, setPreviewing] = useState<PreviewFile | null>(null);
  const closePreview = useCallback(() => setPreviewing(null), []);
  const openLink = useOpenLink();
  const groups = sharedFiles(messages);
  const links = sharedLinks(messages);
  const files = kind === "link" ? [] : groups[kind];
  const countOf = (tab: Tab) => (tab === "link" ? links.length : groups[tab].length);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="group" aria-label="파일 종류" className="flex flex-none gap-1 px-3 pt-2">
        {TABS.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={k === kind}
            onClick={() => setKind(k)}
            className={`rounded-control px-2 py-1 text-[12.5px] font-medium ${
              k === kind ? "bg-sky-soft text-sky-text" : "text-ink-soft hover:bg-hover"
            }`}
          >
            {LABEL[k]} {countOf(k)}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {kind === "link" ? (
          links.length === 0 ? (
            <p className="pt-8 text-center text-[13px] text-ink-faint">공유된 링크가 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {links.map((entry, index) => {
                const name = "link" in entry ? names.get(entry.link.documentId) : undefined;
                const label =
                  "url" in entry
                    ? entry.url
                    : `${name ?? entry.link.documentName}${entry.link.blockId ? ` › ${entry.link.excerpt ?? "블록"}` : ""}`;
                const what = "url" in entry ? "URL" : name === undefined ? "삭제된 문서" : entry.link.blockId ? "블록" : "문서";
                return (
                  <li key={`${entry.messageId}:${index}`} className="flex items-center gap-2.5 rounded-control px-2 py-1.5 hover:bg-hover">
                    <span aria-hidden className="flex size-8 flex-none items-center justify-center rounded-control bg-paper-2 text-ink-soft">
                      <FileIcon />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink">{label}</span>
                      <span className="block truncate text-xs text-ink-faint">
                        {what} · {entry.sender} · <time dateTime={entry.sentAt}>{when.format(new Date(entry.sentAt))}</time>
                      </span>
                    </span>
                    {"url" in entry ? (
                      <a href={entry.url} target="_blank" rel="noopener noreferrer" aria-label={`${label} 열기`} className={ACTION}>
                        열기
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled={name === undefined}
                        onClick={() => openLink(entry.link)}
                        aria-label={`${label} 열기`}
                        className={`${ACTION} disabled:opacity-40`}
                      >
                        열기
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )
        ) : files.length === 0 ? (
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
                    onClick={() => setPreviewing(attachment)}
                    aria-label={`${attachment.fileName} 미리보기`}
                    className={ACTION}
                  >
                    미리보기
                  </button>
                ) : null}
                <a
                  href={`/api/files/${attachment.fileId}/download`}
                  aria-label={`${attachment.fileName} 내려받기`}
                  className={ACTION}
                >
                  내려받기
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      <FilePreviewDialog file={previewing} onClose={closePreview} />
    </div>
  );
}
