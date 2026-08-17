import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import WebSocket from "ws";

import { wsHub } from "./ws-hub.mts";

async function withServer(fn: (port: number) => Promise<void>) {
  const server: Server = createServer();
  server.on("upgrade", (req, socket, head) => wsHub.handleUpgrade(req, socket, head));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  try {
    await fn(port);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function connect(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
  });
}

function nextMessage(ws: WebSocket): Promise<unknown> {
  return new Promise((resolve) => {
    ws.once("message", (data) => resolve(JSON.parse(data.toString())));
  });
}

function closeAndWait(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    ws.once("close", () => resolve());
    ws.close();
  });
}

test("broadcast() delivers to a connected client", async () => {
  await withServer(async (port) => {
    const client = await connect(port);
    const received = nextMessage(client);

    wsHub.broadcast("chat:message", { text: "hello" });

    assert.deepEqual(await received, { event: "chat:message", payload: { text: "hello" } });
    await closeAndWait(client);
  });
});

test("broadcast() reaches every connected client", async () => {
  await withServer(async (port) => {
    const [a, b] = await Promise.all([connect(port), connect(port)]);
    const [receivedA, receivedB] = [nextMessage(a), nextMessage(b)];

    wsHub.broadcast("chat:message", { text: "for everyone" });

    const expected = { event: "chat:message", payload: { text: "for everyone" } };
    assert.deepEqual(await receivedA, expected);
    assert.deepEqual(await receivedB, expected);
    await Promise.all([closeAndWait(a), closeAndWait(b)]);
  });
});

test("broadcast() after a client disconnects does not throw", async () => {
  await withServer(async (port) => {
    const client = await connect(port);
    await closeAndWait(client);
    // Give the 'close' event a tick to remove it from the registry.
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.doesNotThrow(() => wsHub.broadcast("chat:message", { text: "anyone there?" }));
  });
});
