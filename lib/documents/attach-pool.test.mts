import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { createAttachPool } from "./attach-pool.ts";

/** A pool over a fake client that records every call, with each attach and
 *  detach held open until the test lets it finish. */
function harness() {
  const calls: Array<string> = [];
  const pendingAttach: Array<{ resolve: () => void; reject: (e: Error) => void }> = [];
  const pendingDetach: Array<() => void> = [];
  let serial = 0;

  const pool = createAttachPool<string, null>(
    (key) =>
      new Promise<string>((resolve, reject) => {
        const doc = `${key}#${(serial += 1)}`;
        calls.push(`attach ${doc}`);
        pendingAttach.push({ resolve: () => resolve(doc), reject });
      }),
    (doc) =>
      new Promise<void>((resolve) => {
        calls.push(`detach ${doc}`);
        pendingDetach.push(resolve);
      }),
  );

  return { pool, calls, pendingAttach, pendingDetach };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createAttachPool", () => {
  it("shares one attachment between two holders of a key", async () => {
    const { pool, calls, pendingAttach } = harness();

    const first = pool.acquire("a", null);
    const second = pool.acquire("a", null);
    await flush();
    pendingAttach[0].resolve();

    assert.equal(await first, "a#1");
    assert.equal(await second, "a#1");
    assert.deepEqual(calls, ["attach a#1"]);
  });

  it("detaches only when the last holder releases", async () => {
    const { pool, calls, pendingAttach } = harness();

    const held = [pool.acquire("a", null), pool.acquire("a", null)];
    await flush();
    pendingAttach[0].resolve();
    await Promise.all(held);

    pool.release("a");
    await flush();
    assert.deepEqual(calls, ["attach a#1"]);

    pool.release("a");
    await flush();
    assert.deepEqual(calls, ["attach a#1", "detach a#1"]);
  });

  it("waits for a detach in flight before attaching the key again", async () => {
    const { pool, calls, pendingAttach, pendingDetach } = harness();

    const first = pool.acquire("a", null);
    await flush();
    pendingAttach[0].resolve();
    await first;
    pool.release("a");
    await flush();

    const again = pool.acquire("a", null);
    await flush();
    // Attaching now would hit a document the server still marks Attached.
    assert.deepEqual(calls, ["attach a#1", "detach a#1"]);

    pendingDetach[0]();
    await flush();
    pendingAttach[1].resolve();

    assert.equal(await again, "a#2");
    assert.deepEqual(calls, ["attach a#1", "detach a#1", "attach a#2"]);
  });

  it("lets a key whose attach failed be acquired again", async () => {
    const { pool, calls, pendingAttach } = harness();

    const failed = pool.acquire("a", null);
    await flush();
    pendingAttach[0].reject(new Error("offline"));
    await assert.rejects(failed, /offline/);

    const retried = pool.acquire("a", null);
    await flush();
    pendingAttach[1].resolve();

    assert.equal(await retried, "a#2");
    assert.deepEqual(calls, ["attach a#1", "attach a#2"]);
  });

  it("keeps keys apart", async () => {
    const { pool, calls, pendingAttach } = harness();

    const a = pool.acquire("a", null);
    const b = pool.acquire("b", null);
    await flush();
    pendingAttach.forEach((pending) => pending.resolve());

    assert.equal(await a, "a#1");
    assert.equal(await b, "b#2");
    assert.equal(calls.length, 2);
  });
});
