import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ChatMessage, ChatRepository } from "./types.ts";

const DEFAULT_STORE_PATH = path.resolve(".data/chat/messages.json");

/**
 * JSON-file-backed `ChatRepository` — rewrites the whole file per `append()`.
 * Fine at this project's scale (up to 8 users, plain-text messages); not a
 * design for a high-throughput store.
 */
export class JsonChatRepository implements ChatRepository {
  // Two concurrent `append()` calls would otherwise race: both read the same
  // array, both write back, the second write silently drops the first's
  // message. Serialized through one promise chain.
  private queue: Promise<unknown> = Promise.resolve();

  // `storePath` is injectable so tests can point at a scratch file instead of
  // the real `.data/chat/messages.json` — production code never passes it.
  // Spelled out rather than a TS parameter property — see the same note in
  // `chat-service.ts`.
  private readonly storePath: string;

  constructor(storePath: string = DEFAULT_STORE_PATH) {
    this.storePath = storePath;
  }

  async append(message: ChatMessage): Promise<void> {
    const result = this.queue.then(() => this.writeAppend(message));
    // Keep the shared chain healthy even if this particular write fails — one
    // bad write must not permanently block every append() call after it.
    this.queue = result.catch(() => undefined);
    await result;
  }

  list(): Promise<Array<ChatMessage>> {
    return this.readAll();
  }

  private async writeAppend(message: ChatMessage): Promise<void> {
    const messages = await this.readAll();
    messages.push(message);
    await mkdir(path.dirname(this.storePath), { recursive: true });
    // Write-then-rename, not a direct writeFile(): writeFile() truncates the
    // file before writing the new content, so a concurrent list() (which
    // doesn't go through `queue`) can observe a partial file mid-write, and a
    // process crash in that window leaves the store corrupted. rename() on
    // the same filesystem is atomic — readers only ever see the old complete
    // file or the new complete file, never something in between.
    const tempPath = `${this.storePath}.tmp`;
    await writeFile(tempPath, JSON.stringify(messages, null, 2));
    await rename(tempPath, this.storePath);
  }

  private async readAll(): Promise<Array<ChatMessage>> {
    try {
      const text = await readFile(this.storePath, "utf8");
      return JSON.parse(text);
    } catch (error) {
      // Only a missing file means "no history yet". Anything else (a
      // permission error, a disk error) must not be swallowed into an empty
      // result — writeAppend() would then persist just the new message and
      // silently destroy whatever history actually exists on disk.
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }
}

export const chatRepository = new JsonChatRepository();
