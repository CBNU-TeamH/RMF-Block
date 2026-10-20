/** The contract between the chat route, `ChatService` and its two collaborators
 *  (FR-060-01/04/05/07, `docs/design/chat.md`). Both are interfaces, so the
 *  service imports neither the JSON store nor the WS hub. */

/** A file travelling with a message (FR-060-02), copied rather than resolved at
 *  render time — why: `docs/design/chat.md`. */
export type ChatAttachment = {
  fileId: string;
  fileName: string;
  fileType: string;
  size: number;
};

/** A document, or one block in it, travelling with a message (FR-060-03). The
 *  name and excerpt are what was shared when it was sent — why kept, not read
 *  live: `docs/design/chat.md`, "Links". */
export type ChatLink = {
  documentId: string;
  /** Absent for a link to the whole document. */
  blockId?: string;
  documentName: string;
  /** The block's opening text, or its file's name. */
  excerpt?: string;
};

/** What a sender names to link; the server describes the rest (FR-060-03). */
export type ChatLinkRequest = Pick<ChatLink, "documentId" | "blockId" | "excerpt">;

export type ChatMessage = {
  id: string;
  sender: string;
  /** Empty when the message is only an attachment — see `SendChatMessageInput`. */
  text: string;
  attachment?: ChatAttachment;
  link?: ChatLink;
  sentAt: string;
};

export type SendChatMessageInput = {
  /** From the session, never the request (`docs/design/chat.md`). */
  sender: string;
  text: string | undefined;
  /** From the store, never the request (`docs/design/chat.md`). */
  attachment?: ChatAttachment;
  /** Its document's name from the catalogue, never the request. */
  link?: ChatLink;
};

/** Thrown for input the sender controls — route.ts maps this to a 400, not a 500. */
export class ChatValidationError extends Error {}

export interface ChatRepository {
  append(message: ChatMessage): Promise<void>;
  list(): Promise<Array<ChatMessage>>;
}

export interface ChatBroadcaster {
  broadcast(event: string, payload: unknown): void;
}
