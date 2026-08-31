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

export type ChatMessage = {
  id: string;
  sender: string;
  text: string;
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
