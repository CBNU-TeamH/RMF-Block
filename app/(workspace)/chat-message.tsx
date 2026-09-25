"use client";

import type { ChatAttachment, ChatMessage } from "@/lib/chat/types";
import { readableSize } from "@/lib/files/size";

/** One message in the chat panel (FR-060-01/02). **Prototype** — `docs/ui/` has
 *  no chat artboard, so this borrows the shell's vocabulary and is meant to be
 *  replaced once there is a design, not defended. */

/** The four types `preview` will serve inline — anything else gets a card. */
const INLINE_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const time = new Intl.DateTimeFormat("ko-KR", {
  hour: "numeric",
  minute: "2-digit",
  // Pinned for the reason `document-list.tsx` pins its own: the container runs
  // UTC and the people reading run their own clock, and a server-rendered
  // timestamp that disagrees with the hydrated one is a React error.
  timeZone: "Asia/Seoul",
});

/** An image if the server will serve it inline, a card otherwise. The list is
 *  restated rather than imported because this copy only picks a layout — getting
 *  it wrong shows a broken image, while `lib/files/serving.ts` decides whether
 *  anything renders at all. */
function Attachment({ attachment }: { attachment: ChatAttachment }) {
  const download = `/api/files/${attachment.fileId}/download`;

  if (INLINE_IMAGE_TYPES.has(attachment.fileType)) {
    return (
      <a href={download} className="mt-1 block w-fit">
        {/* Not `next/image`: these are runtime uploads with no known dimensions,
            and the optimizer would need a remote pattern for a path that is
            already same-origin and already sized by the server. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/files/${attachment.fileId}/preview`}
          alt={attachment.fileName}
          className="max-h-60 max-w-full rounded-control"
        />
      </a>
    );
  }

  return (
    <a
      href={download}
      className="mt-1 flex w-fit max-w-full items-center gap-2.5 rounded-control bg-paper-2 py-1.5 pr-3 pl-1.5 hover:bg-hover"
    >
      <span aria-hidden className="flex size-8 flex-none items-center justify-center rounded-control bg-paper text-ink-soft">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinejoin="round">
          <path d="M4 2.5h5l3 3v8H4z" />
          <path d="M9 2.5v3h3" />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-medium text-ink">{attachment.fileName}</span>
        <span className="text-xs text-ink-faint">{readableSize(attachment.size)} · 내려받기</span>
      </span>
    </a>
  );
}

export function ChatMessageRow({
  message,
  mine,
  colorTag,
}: {
  message: ChatMessage;
  mine: boolean;
  /** The sender's colour when the roster knows them, so one person reads the
   * same here as in the document list and the presence stack. */
  colorTag: string | undefined;
}) {
  return (
    // Left-aligned, no bubbles (`docs/ui/redesign/HANDOFF.md` §3). Your own
    // name in sky until HANDOFF's "나" badge lands.
    <li className="flex gap-2.5 rounded-control px-2 py-1.5 hover:bg-hover">
      <span
        aria-hidden
        style={colorTag ? { backgroundColor: colorTag } : undefined}
        className={`mt-0.5 inline-flex size-[26px] flex-none items-center justify-center rounded-full text-[11.5px] font-semibold ${
          colorTag ? "text-white" : "bg-paper-2 text-ink-soft"
        }`}
      >
        {message.sender.slice(0, 1)}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline gap-1.5">
          <span className={`text-[13.5px] font-semibold ${mine ? "text-sky-text" : "text-ink"}`}>
            {message.sender}
          </span>
          <time dateTime={message.sentAt} className="text-xs text-ink-faint">
            {time.format(new Date(message.sentAt))}
          </time>
        </span>

        {message.text ? (
          <p className="text-[14px] leading-[1.55] break-words whitespace-pre-wrap text-ink">
            {message.text}
          </p>
        ) : null}

        {message.attachment ? <Attachment attachment={message.attachment} /> : null}
      </div>
    </li>
  );
}
