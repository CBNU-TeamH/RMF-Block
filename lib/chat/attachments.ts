import type { ChatAttachment, ChatMessage } from "./types.ts";

/** The chat file list (UC-061), grouped from the history — why not the file
 *  store: `docs/design/chat.md`, "The file list". */

/** UC-061 step 3's tabs. A link attachment (FR-060-03, #147) joins as a fourth. */
export const KINDS = ["image", "pdf", "document"] as const;

export type AttachmentKind = (typeof KINDS)[number];

export type SharedFile = {
  messageId: string;
  sender: string;
  sentAt: string;
  attachment: ChatAttachment;
};

/** By the stored type: any `image/*` is an image here even when it cannot be
 *  previewed (`image/svg+xml`) — the tab says what it is, not what opens. */
export function kindOf(fileType: string): AttachmentKind {
  if (fileType.startsWith("image/")) return "image";
  if (fileType === "application/pdf") return "pdf";
  return "document";
}

/** Every attachment in the history by kind, newest first. */
export function sharedFiles(messages: Array<ChatMessage>): Record<AttachmentKind, Array<SharedFile>> {
  const groups: Record<AttachmentKind, Array<SharedFile>> = { image: [], pdf: [], document: [] };
  for (const { id, sender, sentAt, attachment } of messages) {
    if (attachment) groups[kindOf(attachment.fileType)].push({ messageId: id, sender, sentAt, attachment });
  }
  for (const kind of KINDS) groups[kind].sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  return groups;
}
