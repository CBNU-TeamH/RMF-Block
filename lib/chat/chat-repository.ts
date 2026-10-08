import path from "node:path";

import { readJsonFile, writeJsonFile } from "../json-file.ts";
import type { ChatMessage, ChatRepository } from "./types.ts";

const DEFAULT_STORE_PATH = path.resolve(".data/chat/messages.json");

/**
 * JSON-file-backed `ChatRepository` — rewrites the whole file per `append()`.
 * Fine at this project's scale (up to 8 users, plain-text messages); not a
 * design for a high-throughput store.
 *
 * The read-modify-write in `append()` is synchronous, so two concurrent calls
 * cannot interleave and drop a message — why no queue: `docs/design/chat.md`,
 * "Storage". The methods stay `async` because the `ChatRepository` contract is.
 */
export class JsonChatRepository implements ChatRepository {
  // `storePath` is injectable so tests can point at a scratch file instead of
  // the real `.data/chat/messages.json` — production code never passes it.
  // Spelled out rather than a TS parameter property — see the same note in
  // `chat-service.ts`.
  private readonly storePath: string;

  constructor(storePath: string = DEFAULT_STORE_PATH) {
    this.storePath = storePath;
  }

  async append(message: ChatMessage): Promise<void> {
    writeJsonFile(this.storePath, [...this.readAll(), message]);
  }

  async list(): Promise<Array<ChatMessage>> {
    return this.readAll();
  }

  private readAll(): Array<ChatMessage> {
    return readJsonFile(this.storePath, []);
  }
}

export const chatRepository = new JsonChatRepository();
