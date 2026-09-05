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

export type ChatMessage = {
  id: string;
  sender: string;
  /** Empty when the message is only an attachment — see `SendChatMessageInput`. */
  text: string;
  attachment?: ChatAttachment;
  sentAt: string;
};

export type SendChatMessageInput = {
  /** From the session, never the request (`docs/design/chat.md`). */
  sender: string;
  text: string | undefined;
  /** From the store, never the request (`docs/design/chat.md`). */
  attachment?: ChatAttachment;
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
