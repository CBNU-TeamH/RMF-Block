/**
 * Shared contract between `app/api/chat/route.ts` (the caller) and `ChatService`
 * (`chat-service.ts`), and between `ChatService` and its two collaborators — a
 * `ChatRepository` for persistence and a `ChatBroadcaster` for realtime fan-out
 * (FR-060-01/04/05/07, `docs/design/api.md` §5 Version A).
 *
 * Both collaborators are interfaces, not concrete classes, so `ChatService` never
 * imports `chat-repository.ts` or `ws-hub.mts` directly — swapping the JSON-file
 * store for something else, or reusing the broadcaster for a feature other than
 * chat, doesn't touch this file or `ChatService`.
 */

/**
 * A file travelling with a message (FR-060-02).
 *
 * **The same four fields as `FileBlock`** in `lib/blocks/types.ts`. A file
 * attached to a message and a file embedded in a document are the same thing
 * seen from two places, and FR-060-03's document and block links are the next
 * attachment kind — sharing the vocabulary now is what lets them join as a
 * sibling rather than a special case.
 *
 * Copied onto the message rather than looked up by `fileId` when rendering, for
 * the reason `document-editing.md` gives the file block: a name and a size the
 * client already has is a chat history that draws without a round-trip per
 * message. Files have no rename in the SRS, so the copy cannot go stale.
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
