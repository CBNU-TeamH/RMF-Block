import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { YorkieTokenRegistry } from "./yorkie-token.ts";

const HOUR = 60 * 60 * 1000;

describe("YorkieTokenRegistry.issue", () => {
  it("gives back a token that resolves to the session it was issued for", () => {
    const registry = new YorkieTokenRegistry();

    const token = registry.issue("session-alice");

    assert.equal(registry.resolve(token), "session-alice");
  });

  it("gives different sessions different tokens", () => {
    const registry = new YorkieTokenRegistry();

    const tokens = new Set(
      Array.from({ length: 100 }, (_, i) => registry.issue(`session-${i}`)),
    );

    assert.equal(tokens.size, 100);
  });

  it("hands a session back the token it already holds", () => {
    // Two tabs share one, which is right — the token authorizes a session and
    // both tabs are that session. It is also what bounds the map: minting per
    // call would let a session that keeps being refused fetch in a loop and
    // leave an entry behind each time, for a whole hour.
    const registry = new YorkieTokenRegistry();

    const first = registry.issue("session-alice");
    const second = registry.issue("session-alice");

    assert.equal(second, first);
    assert.equal(registry.resolve(first), "session-alice");
  });

  it("does not grow when one session asks repeatedly", () => {
    const registry = new YorkieTokenRegistry();

    const tokens = new Set(
      Array.from({ length: 1000 }, () => registry.issue("session-alice")),
    );

    assert.equal(tokens.size, 1);
  });

  it("mints a fresh token once the held one has expired", () => {
    const registry = new YorkieTokenRegistry();
    const first = registry.issue("session-alice", 0);

    const second = registry.issue("session-alice", HOUR);

    assert.notEqual(second, first);
    assert.equal(registry.resolve(first, HOUR), null);
    assert.equal(registry.resolve(second, HOUR), "session-alice");
  });

  it("keeps sessions apart", () => {
    const registry = new YorkieTokenRegistry();

    const alice = registry.issue("session-alice");
    const bob = registry.issue("session-bob");

    assert.equal(registry.resolve(alice), "session-alice");
    assert.equal(registry.resolve(bob), "session-bob");
  });
});

describe("YorkieTokenRegistry.resolve", () => {
  it("returns null for a token it never issued", () => {
    const registry = new YorkieTokenRegistry();

    assert.equal(registry.resolve("not-a-token"), null);
  });

  it("returns null for a missing token", () => {
    // Yorkie sends `token: ""` for a client that supplied no injector at all.
    const registry = new YorkieTokenRegistry();

    assert.equal(registry.resolve(""), null);
    assert.equal(registry.resolve(undefined), null);
  });

  it("says nothing about whether the session is still live", () => {
    // Deliberately: `sessionRegistry` owns that question, and keeping it out is
    // what lets this be tested without one. The webhook asks both in turn.
    const registry = new YorkieTokenRegistry();

    const token = registry.issue("a-session-that-may-be-long-gone");

    assert.equal(registry.resolve(token), "a-session-that-may-be-long-gone");
  });
});

describe("YorkieTokenRegistry expiry", () => {
  it("still resolves just before the hour is up", () => {
    const registry = new YorkieTokenRegistry();
    const token = registry.issue("session-alice", 0);

    assert.equal(registry.resolve(token, HOUR - 1), "session-alice");
  });

  it("stops resolving once the hour has passed", () => {
    const registry = new YorkieTokenRegistry();
    const token = registry.issue("session-alice", 0);

    assert.equal(registry.resolve(token, HOUR), null);
    assert.equal(registry.resolve(token, HOUR + 60_000), null);
  });

  it("forgets an expired token rather than holding it as a tombstone", () => {
    const registry = new YorkieTokenRegistry();
    const token = registry.issue("session-alice", 0);

    registry.resolve(token, HOUR);

    // Re-resolving at a time before the expiry must not revive it: the entry is
    // gone, not merely hidden.
    assert.equal(registry.resolve(token, 0), null);
  });

  it("clears expired tokens when the next one is issued", () => {
    // The map only grows on issue, so that is the only moment it is pruned —
    // no timer to keep alive. Checked through behaviour: the old token is gone
    // even though nothing ever resolved it.
    const registry = new YorkieTokenRegistry();
    const stale = registry.issue("session-alice", 0);

    registry.issue("session-bob", HOUR + 1);

    assert.equal(registry.resolve(stale, 0), null);
  });

  it("leaves tokens that are still valid alone while pruning", () => {
    const registry = new YorkieTokenRegistry();
    const stale = registry.issue("session-alice", 0);
    // A different session, so this is a second entry rather than the first one
    // handed back — the pruning pass has to tell them apart.
    const fresh = registry.issue("session-bob", HOUR - 1);

    registry.issue("session-carol", HOUR + 1);

    assert.equal(registry.resolve(stale, HOUR + 1), null);
    assert.equal(registry.resolve(fresh, HOUR + 1), "session-bob");
  });
});
