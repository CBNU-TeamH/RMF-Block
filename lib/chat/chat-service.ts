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

/** FR-060-01/03/04/05/07, over two interfaces rather than the store and the hub.
 *  Its rules and why: `docs/design/chat.md`, "Module structure". */
export class ChatService {
  // Not parameter properties: Node's type stripping (Vitest) cannot emit them.
  private readonly repository: ChatRepository;
  private readonly broadcaster: ChatBroadcaster;

  constructor(repository: ChatRepository, broadcaster: ChatBroadcaster) {
    this.repository = repository;
    this.broadcaster = broadcaster;
  }

  async send({ sender, text, attachment, link }: SendChatMessageInput): Promise<ChatMessage> {
    if (!text?.trim() && !attachment && !link) {
      throw new ChatValidationError("메시지나 첨부 파일 중 하나는 있어야 합니다.");
    }
    if (text && text.length > 2000) {
      throw new ChatValidationError("text is too long");
    }

    const message: ChatMessage = {
      id: randomUUID(),
      sender,
      text: text ?? "",
      // Left out, not `undefined`, which the JSON store reads back as `null`.
      ...(attachment ? { attachment } : {}),
      ...(link ? { link } : {}),
      sentAt: new Date().toISOString(),
    };

    // Persisted first: a broadcast message must survive a restart.
    await this.repository.append(message);
    this.broadcaster.broadcast("chat:message", message);

    return message;
  }

  list(): Promise<Array<ChatMessage>> {
    return this.repository.list();
  }
}

export const chatService = new ChatService(chatRepository, wsHub);
