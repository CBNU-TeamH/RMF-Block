import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test } from "vitest";
import WebSocket from "ws";

import { wsHub } from "./ws-hub.mts";

async function withServer(
  fn: (port: number) => Promise<void>,
  // Stands in for `server/index.mts` reading the session cookie off the upgrade
  // request; the test controls which session each connection is filed under.
  sessionIdFor: (url: string | undefined) => string | null = () => null,
  // Stands in for `server/index.mts`'s `sessionRegistry.resolve()` check.
  isSessionValid: (sessionId: string) => boolean = () => true,
) {
  const server: Server = createServer();
  server.on("upgrade", (req, socket, head) =>
    wsHub.handleUpgrade(req, socket, head, sessionIdFor(req.url), isSessionValid),
  );
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  try {
    await fn(port);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function connect(port: number, path = "/"): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}${path}`);
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

function nextClose(ws: WebSocket): Promise<number> {
  return new Promise((resolve) => ws.once("close", (code) => resolve(code)));
}

// The session id is taken from the path so one server can hand out different
// ones: `ws://host/<sessionId>`.
const sessionFromPath = (url: string | undefined) => url?.slice(1) || null;

test("revoke() warns the displaced session before closing it", async () => {
  await withServer(async (port) => {
    const client = await connect(port, "/session-a");
    const received = nextMessage(client);
    const closed = nextClose(client);

    wsHub.revoke("session-a");

    // The message has to arrive: a client that only saw the close could not tell
    // eviction from a dropped network, and those want different handling.
    assert.deepEqual(await received, { event: "session:revoked", payload: null });
    assert.equal(await closed, 4001);
  }, sessionFromPath);
});

test("revoke() leaves other sessions connected", async () => {
  await withServer(async (port) => {
    const [evicted, bystander] = await Promise.all([
      connect(port, "/session-a"),
      connect(port, "/session-b"),
    ]);
    const closed = nextClose(evicted);

    wsHub.revoke("session-a");
    await closed;

    assert.equal(bystander.readyState, WebSocket.OPEN);
    await closeAndWait(bystander);
  }, sessionFromPath);
});

test("revoke() ignores connections with no session", async () => {
  await withServer(async (port) => {
    const anonymous = await connect(port);

    // Chat never authenticated its socket and still does not.
    wsHub.revoke("session-a");
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.equal(anonymous.readyState, WebSocket.OPEN);
    await closeAndWait(anonymous);
  });
});

test("handleUpgrade() rejects a session that no longer resolves instead of registering it", async () => {
  await withServer(
    async (port) => {
      // Not `connect()`: the server sends the frame and closes as part of the
      // same upgrade that would otherwise resolve `open`, so listeners have
      // to be attached before that — not after awaiting `open` — to not race it.
      const client = new WebSocket(`ws://localhost:${port}/session-a`);
      const received = nextMessage(client);
      const closed = nextClose(client);

      // The race in #26: this connection arrives after its session was
      // already displaced, so nothing was ever registered for `revoke()` to
      // find — the check has to happen at registration time instead.
      assert.deepEqual(await received, { event: "session:revoked", payload: null });
      assert.equal(await closed, 4001);
    },
    sessionFromPath,
    () => false,
  );
});
