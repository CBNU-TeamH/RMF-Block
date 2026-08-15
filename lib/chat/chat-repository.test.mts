import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { JsonChatRepository } from "./chat-repository.ts";
import type { ChatMessage } from "./types.ts";

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: randomUUID(),
    sender: "alice",
    text: "hi",
    sentAt: new Date().toISOString(),
    ...overrides,
  };
}

async function withTempStore(fn: (repo: JsonChatRepository) => Promise<void>) {
  const dir = await mkdtemp(path.join(tmpdir(), "chat-repo-test-"));
  try {
    await fn(new JsonChatRepository(path.join(dir, "messages.json")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("list() on a fresh store returns an empty array", async () => {
  await withTempStore(async (repo) => {
    assert.deepEqual(await repo.list(), []);
  });
});

test("append() then list() round-trips a message", async () => {
  await withTempStore(async (repo) => {
    const message = makeMessage();
    await repo.append(message);
    assert.deepEqual(await repo.list(), [message]);
  });
});

test("append() preserves order across multiple calls", async () => {
  await withTempStore(async (repo) => {
    const first = makeMessage({ text: "first" });
    const second = makeMessage({ text: "second" });
    await repo.append(first);
    await repo.append(second);
    assert.deepEqual(await repo.list(), [first, second]);
  });
});

test("concurrent append() calls don't lose messages (the read-modify-write race)", async () => {
  await withTempStore(async (repo) => {
    const messages = Array.from({ length: 10 }, (_, i) => makeMessage({ text: `msg-${i}` }));

    // Fire all ten without awaiting between them — exactly the race the
    // internal queue (chat-repository.ts) exists to prevent.
    await Promise.all(messages.map((message) => repo.append(message)));

    const stored = await repo.list();
    assert.equal(stored.length, messages.length);
    assert.deepEqual(new Set(stored.map((m) => m.id)), new Set(messages.map((m) => m.id)));
  });
});

test("list() surfaces a non-ENOENT read failure instead of treating it as empty", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "chat-repo-test-"));
  try {
    // A directory where a file is expected — readFile() fails with EISDIR,
    // not ENOENT, so this must propagate rather than come back as [].
    const storePath = path.join(dir, "messages.json");
    await mkdir(storePath);

    const repo = new JsonChatRepository(storePath);
    await assert.rejects(() => repo.list());
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
