/**
 * The contract between the chat route, `ChatService` and its two collaborators
 * (FR-060-01/04/05/07, `docs/design/chat.md`).
 *
 * Both collaborators are interfaces, so `ChatService` imports neither the JSON
 * store nor the WS hub and either can be swapped without touching it.
 */

/**
 * A file travelling with a message (FR-060-02) — deliberately the same four
 * fields as `FileBlock`, since an attached file and an embedded one are one
 * thing seen from two places.
 *
 * Copied onto the message rather than resolved by `fileId` at render time, so
 * history draws without a round trip per message. Files have no rename in the
 * SRS, so the copy cannot go stale.
 */
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
  /**
   * Who is sending, decided by the caller from the session — never by the
   * request. Non-optional because there is no longer a way for it to be
   * missing: `currentMember()` either produces a member or the route answers
   * 401 before reaching here.
   */
  sender: string;
  text: string | undefined;
  /**
   * Resolved by the caller from the store, never taken from the request. A
   * client that could name its own `fileName` and `size` could describe a file
   * as something it is not, and the description is what everyone else renders.
   */
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
