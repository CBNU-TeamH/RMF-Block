import { randomUUID } from "node:crypto";

import { chatRepository } from "./chat-repository.ts";
import {
  ChatValidationError,
  type ChatBroadcaster,
  type ChatMessage,
  type ChatRepository,
  type SendChatMessageInput,
} from "./types.ts";
import { wsHub } from "../../server/ws-hub.mts";

/**
 * FR-060-01/04/05/07. Depends on `ChatRepository`/`ChatBroadcaster` as interfaces
 * only (`types.ts`) — swapping the JSON-file store for something else, or reusing
 * the broadcaster for a feature other than chat, never touches this class.
 */
export class ChatService {
  // Spelled out rather than TS parameter properties: this class is loaded
  // both through Next's bundler (route.ts) and directly by `node --test`
  // (chat-service.test.mts), and Node's native type stripping — unlike a real
  // compiler — cannot generate the `this.x = x` a parameter property implies.
  private readonly repository: ChatRepository;
  private readonly broadcaster: ChatBroadcaster;

  constructor(repository: ChatRepository, broadcaster: ChatBroadcaster) {
    this.repository = repository;
    this.broadcaster = broadcaster;
  }

  // `sender` is not validated here, unlike `text`. It comes from the session
  // rather than the request now, and a session's nickname was trimmed and
  // checked for emptiness when it was minted (`SessionRegistry.join`) — so
  // there is nothing left for this method to catch. `text` is still whatever
  // the person typed.
  async send({ sender, text }: SendChatMessageInput): Promise<ChatMessage> {
    if (!text?.trim()) {
      throw new ChatValidationError("text is required");
    }
    // Neither `request.json()` (App Router) nor the custom server caps body
    // size, and every append rewrites the whole JSON file — so unbounded text
    // is both a disk-fill and a per-message O(n) rewrite.
    if (text.length > 2000) {
      throw new ChatValidationError("text is too long");
    }

    const message: ChatMessage = {
      id: randomUUID(),
      sender,
      text,
      sentAt: new Date().toISOString(),
    };

    // Persist before broadcasting: a client should never see a message over WS
    // that a server restart would then fail to produce from `list()`.
    await this.repository.append(message);
    this.broadcaster.broadcast("chat:message", message);

    return message;
  }

  list(): Promise<Array<ChatMessage>> {
    return this.repository.list();
  }
}

export const chatService = new ChatService(chatRepository, wsHub);
