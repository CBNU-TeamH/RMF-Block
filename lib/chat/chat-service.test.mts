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

// There is no "rejects a blank sender" test any more. `sender` is typed
// non-optional and comes from the session, whose nickname `SessionRegistry.join`
// already trimmed and refused when empty — so a blank one cannot reach here, and
// a test for it would be asserting against a caller that cannot exist.

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

test("send() stores sender and text as given, and stamps id/sentAt", async () => {
  // Neither is trimmed: `sender` arrives already trimmed from the session, and
  // trimming `text` would silently edit what someone typed.
  const service = new ChatService(fakeRepository(), fakeBroadcaster());
  const message = await service.send({ sender: "alice", text: "  hi  " });

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

const attachment = {
  fileId: "6f9619ff-8b86-4d01-b42d-00cf4fc964ff",
  fileName: "cat.png",
  fileType: "image/png",
  size: 8421,
};

test("send() accepts an attachment with no text", async () => {
  // UC-060 step 1 is "텍스트 또는 URL을 입력하거나 파일을 첨부한다" — a photo
  // with nothing typed under it is a message, and requiring text refuses it.
  const service = new ChatService(fakeRepository(), fakeBroadcaster());

  const message = await service.send({ sender: "alice", text: undefined, attachment });

  assert.deepEqual(message.attachment, attachment);
  assert.equal(message.text, "", "text is a string even when nothing was typed");
});

test("send() rejects a message that is neither text nor attachment", async () => {
  const service = new ChatService(fakeRepository(), fakeBroadcaster());

  await assert.rejects(
    () => service.send({ sender: "alice", text: "   " }),
    ChatValidationError,
  );
});

test("send() carries text and an attachment together", async () => {
  const service = new ChatService(fakeRepository(), fakeBroadcaster());

  const message = await service.send({ sender: "alice", text: "이거 봐", attachment });

  assert.equal(message.text, "이거 봐");
  assert.deepEqual(message.attachment, attachment);
});

test("send() leaves the key out entirely when there is no attachment", async () => {
  // Not `attachment: undefined`, which the JSON store would read back as null.
  const service = new ChatService(fakeRepository(), fakeBroadcaster());

  const message = await service.send({ sender: "alice", text: "hi" });

  assert.equal("attachment" in message, false);
  assert.equal(JSON.parse(JSON.stringify(message)).attachment, undefined);
});

test("send() broadcasts the attachment along with the message", async () => {
  // FR-060-04 asks for the message *and* its attachment info to reach everyone.
  const broadcaster = fakeBroadcaster();
  const service = new ChatService(fakeRepository(), broadcaster);

  await service.send({ sender: "alice", text: "", attachment });

  assert.deepEqual(
    (broadcaster.calls[0]!.payload as ChatMessage).attachment,
    attachment,
  );
});

test("send() still caps text when an attachment rides with it", async () => {
  const service = new ChatService(fakeRepository(), fakeBroadcaster());

  await assert.rejects(
    () => service.send({ sender: "alice", text: "x".repeat(2001), attachment }),
    ChatValidationError,
  );
});
