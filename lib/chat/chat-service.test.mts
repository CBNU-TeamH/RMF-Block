import assert from "node:assert/strict";
import { test } from "node:test";

import { ChatService } from "./chat-service.ts";
import { ChatValidationError, type ChatMessage } from "./types.ts";

function fakeRepository() {
  const messages: Array<ChatMessage> = [];
  return {
    messages,
    append: async (message: ChatMessage) => {
      messages.push(message);
    },
    list: async () => messages,
  };
}

function fakeBroadcaster() {
  const calls: Array<{ event: string; payload: unknown }> = [];
  return {
    calls,
    broadcast: (event: string, payload: unknown) => {
      calls.push({ event, payload });
    },
  };
}

test("send() rejects a missing or blank sender", async () => {
  const service = new ChatService(fakeRepository(), fakeBroadcaster());
  await assert.rejects(() => service.send({ sender: undefined, text: "hi" }), ChatValidationError);
  await assert.rejects(() => service.send({ sender: "   ", text: "hi" }), ChatValidationError);
});

test("send() rejects a missing or blank text", async () => {
  const service = new ChatService(fakeRepository(), fakeBroadcaster());
  await assert.rejects(() => service.send({ sender: "alice", text: undefined }), ChatValidationError);
  await assert.rejects(() => service.send({ sender: "alice", text: "   " }), ChatValidationError);
});

test("send() rejects text over 2000 characters", async () => {
  const service = new ChatService(fakeRepository(), fakeBroadcaster());
  await assert.rejects(
    () => service.send({ sender: "alice", text: "x".repeat(2001) }),
    ChatValidationError,
  );
  // Exactly at the limit is still fine — off-by-one check.
  await assert.doesNotReject(() => service.send({ sender: "alice", text: "x".repeat(2000) }));
});

test("send() trims sender but leaves text as-is, and stamps id/sentAt", async () => {
  const service = new ChatService(fakeRepository(), fakeBroadcaster());
  const message = await service.send({ sender: "  alice  ", text: "  hi  " });

  assert.equal(message.sender, "alice");
  assert.equal(message.text, "  hi  ");
  assert.ok(message.id);
  assert.ok(!Number.isNaN(Date.parse(message.sentAt)));
});

test("send() persists before broadcasting, in that order", async () => {
  const order: Array<string> = [];
  const repository = fakeRepository();
  const append = repository.append;
  repository.append = async (message) => {
    order.push("append");
    await append(message);
  };
  const broadcaster = fakeBroadcaster();
  const broadcast = broadcaster.broadcast;
  broadcaster.broadcast = (event, payload) => {
    order.push("broadcast");
    broadcast(event, payload);
  };

  await new ChatService(repository, broadcaster).send({ sender: "alice", text: "hi" });

  assert.deepEqual(order, ["append", "broadcast"]);
});

test("send() does not broadcast if persisting fails", async () => {
  const repository = fakeRepository();
  repository.append = async () => {
    throw new Error("disk full");
  };
  const broadcaster = fakeBroadcaster();

  await assert.rejects(() => new ChatService(repository, broadcaster).send({ sender: "alice", text: "hi" }));
  assert.equal(broadcaster.calls.length, 0);
});

test("send() broadcasts chat:message with the created message", async () => {
  const broadcaster = fakeBroadcaster();
  const message = await new ChatService(fakeRepository(), broadcaster).send({ sender: "alice", text: "hi" });

  assert.deepEqual(broadcaster.calls, [{ event: "chat:message", payload: message }]);
});

test("list() delegates to the repository", async () => {
  const repository = fakeRepository();
  const service = new ChatService(repository, fakeBroadcaster());
  await service.send({ sender: "alice", text: "hi" });

  assert.deepEqual(await service.list(), repository.messages);
});
