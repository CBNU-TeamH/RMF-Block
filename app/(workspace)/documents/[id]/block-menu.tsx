"use client";

import { useEffect, useState } from "react";

import { documentLinkUrl } from "@/lib/chat/links";

import { useSendToChat } from "../../chat-window";
import { DocumentRowMenu } from "../../document-row-menu";
import { copyText, icon } from "../../ui";

/** How long "복사됨" stays beside the menu. */
const COPIED_MS = 1500;

/** A block's ··· menu in the gutter: the two ways to share it in chat (FR-060-03,
 *  `docs/design/chat.md`, "Links"). */
export function BlockMenu({
  documentId,
  blockId,
  readExcerpt,
}: {
  documentId: string;
  blockId: string;
  /** Read when sent, not when rendered: the text is the live document's. */
  readExcerpt: () => string | undefined;
}) {
  const sendToChat = useSendToChat();
  const [copied, setCopied] = useState<boolean | null>(null);

  useEffect(() => {
    if (copied === null) return;
    const timer = setTimeout(() => setCopied(null), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <>
      {/* Shown on hover like the gutter's other controls. The notice below is
          outside it, so it shows wherever the pointer went after the click. */}
      <span className="flex opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100 group-focus-within:opacity-100">
        <DocumentRowMenu
          label="블록"
          items={[
            {
              label: "채팅으로 보내기",
              icon: icon(<path d="M2.5 8l11-5-4 11-2-4.5z" />),
              onSelect: () => sendToChat({ documentId, blockId, excerpt: readExcerpt() }),
            },
            {
              label: "링크 복사",
              icon: icon(<path d="M7 9a3 3 0 004.2 0l2-2a3 3 0 00-4.2-4.2l-.8.8M9 7a3 3 0 00-4.2 0l-2 2A3 3 0 007 13.2l.8-.8" />),
              onSelect: () => void copyText(documentLinkUrl(window.location.origin, documentId, blockId)).then(setCopied),
            },
          ]}
        />
      </span>
      {copied !== null ? (
        <span role="status" className="absolute top-0 left-full ml-1 rounded-control bg-ink px-1.5 py-0.5 text-[11px] whitespace-nowrap text-paper">
          {copied ? "복사됨" : "복사하지 못했습니다"}
        </span>
      ) : null}
    </>
  );
}
