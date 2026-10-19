"use client";

import { useRouter } from "next/navigation";
import { Fragment, memo } from "react";

import { splitUrls } from "@/lib/chat/links";
import type { ChatAttachment, ChatLink, ChatMessage } from "@/lib/chat/types";
import { isInlineType } from "@/lib/files/serving";
import { readableSize } from "@/lib/files/size";

import { useFloatingViews } from "./floating-views";
import { useFocusFollow } from "./focus-follow-provider";
import { FileIcon } from "./ui";

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
        <FileIcon />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-medium text-ink">{attachment.fileName}</span>
        <span className="text-xs text-ink-faint">{readableSize(attachment.size)} · 내려받기</span>
      </span>
    </a>
  );
}

/** FR-060-06: a block link lands on its block, highlighted (E7a); a document
 *  link opens the document. Shared by the message and the 링크 tab. */
export function useOpenLink(): (link: ChatLink) => void {
  const { goToBlock } = useFocusFollow();
  const router = useRouter();
  return (link) =>
    link.blockId ? goToBlock(link.documentId, link.blockId) : router.push(`/documents/${link.documentId}`);
}

/** A link's card. `name` is the document's name now, `undefined` once it is
 *  gone — then the card shows the name it was sent with, dimmed, and is inert. */
function LinkCard({ link, name }: { link: ChatLink; name: string | undefined }) {
  const open = useOpenLink();
  const gone = name === undefined;

  return (
    <button
      type="button"
      disabled={gone}
      onClick={() => open(link)}
      className="mt-1 flex w-fit max-w-full items-center gap-2.5 rounded-control bg-paper-2 py-1.5 pr-3 pl-1.5 text-left enabled:hover:bg-hover disabled:opacity-60"
    >
      <span aria-hidden className="flex size-8 flex-none items-center justify-center rounded-control bg-paper text-ink-soft">
        <FileIcon />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-medium text-ink">{name ?? link.documentName}</span>
        <span className="block truncate text-xs text-ink-faint">
          {gone ? "삭제된 문서" : link.blockId ? (link.excerpt ?? "블록") : "문서"}
        </span>
      </span>
    </button>
  );
}

/** FR-060-01: a message's `http(s)` URLs open in a new tab; the rest is text. */
function MessageText({ text }: { text: string }) {
  return (
    <p className="text-[14px] leading-[1.55] break-words whitespace-pre-wrap text-ink">
      {splitUrls(text).map((part, index) =>
        "url" in part ? (
          <a
            key={index}
            href={part.url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-sky-text underline underline-offset-2 hover:text-sky-deep"
          >
            {part.url}
          </a>
        ) : (
          <Fragment key={index}>{part.text}</Fragment>
        ),
      )}
    </p>
  );
}

/** FR-070-01's "or a file" — which types float: `docs/design/floating-view.md`. */
function FloatButton({ attachment }: { attachment: ChatAttachment }) {
  const openFloating = useFloatingViews();
  if (!isInlineType(attachment.fileType)) return null;

  return (
    <button
      type="button"
      onClick={() => openFloating(attachment)}
      className="w-fit rounded-control px-1 text-xs text-ink-faint hover:bg-hover hover:text-ink"
    >
      플로팅 뷰로 열기
    </button>
  );
}

/** Memoised: the panel re-renders on every keystroke in its input, and each row
 *  reads its text for URLs. */
export const ChatMessageRow = memo(function ChatMessageRow({
  message,
  mine,
  colorTag,
  linkName,
}: {
  message: ChatMessage;
  mine: boolean;
  /** The linked document's current name, `undefined` once it is gone. */
  linkName?: string;
  /** The sender's colour when the roster knows them, so one person reads the
   * same here as in the document list and the presence stack. */
  colorTag: string | undefined;
}) {
  return (
    // Left-aligned, no bubbles (`docs/ui/redesign/HANDOFF.md` §3). Your own
    // name in sky until HANDOFF's "나" badge lands.
    <li data-message-id={message.id} className="flex gap-2.5 rounded-control px-2 py-1.5 hover:bg-hover">
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

        {message.text ? <MessageText text={message.text} /> : null}

        {message.attachment ? <Attachment attachment={message.attachment} /> : null}
        {message.link ? <LinkCard link={message.link} name={linkName} /> : null}
        {message.attachment ? <FloatButton attachment={message.attachment} /> : null}
      </div>
    </li>
  );
});
