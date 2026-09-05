"use client";

import type { ChatAttachment, ChatMessage } from "@/lib/chat/types";

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

function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

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
          className="max-h-60 max-w-full rounded-md border border-ink"
        />
      </a>
    );
  }

  return (
    <a
      href={download}
      className="mt-1 flex w-fit max-w-full items-center gap-2.5 rounded-md border border-ink bg-paper-2 px-3 py-2"
    >
      <span aria-hidden className="text-base">
        📎
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold text-ink">
          {attachment.fileName}
        </span>
        <span className="font-mono text-[10px] tracking-wide text-ink-faint uppercase">
          {readableSize(attachment.size)} · 내려받기
        </span>
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
    <li className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
      <span
        aria-hidden
        style={colorTag ? { backgroundColor: colorTag } : undefined}
        className="mt-0.5 inline-flex size-6 flex-none items-center justify-center rounded-full border border-ink bg-paper-2 text-[11px] font-bold text-ink"
      >
        {message.sender.slice(0, 1)}
      </span>

      <div className={`flex min-w-0 flex-col ${mine ? "items-end" : "items-start"}`}>
        <span className="flex items-baseline gap-1.5">
          <span className="text-[11px] font-semibold text-ink-soft">{message.sender}</span>
          <time
            dateTime={message.sentAt}
            className="font-mono text-[9.5px] text-ink-faint"
          >
            {time.format(new Date(message.sentAt))}
          </time>
        </span>

        {message.text ? (
          <p
            className={`mt-0.5 w-fit max-w-full rounded-md border border-ink px-2.5 py-1.5 text-[13px] break-words whitespace-pre-wrap text-ink ${
              mine ? "bg-sky-soft" : "bg-paper-2"
            }`}
          >
            {message.text}
          </p>
        ) : null}

        {message.attachment ? <Attachment attachment={message.attachment} /> : null}
      </div>
    </li>
  );
}
