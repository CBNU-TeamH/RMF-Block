import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SessionRegistry } from "./session-registry.ts";
import { JoinValidationError } from "./types.ts";

describe("SessionRegistry.join", () => {
  it("creates a member for a new nickname", () => {
    const registry = new SessionRegistry();

    const { member, sessionId, revokedSessionId } = registry.join("alice");

    assert.equal(member.nickname, "alice");
    assert.ok(member.colorTag);
    assert.ok(sessionId);
    assert.equal(revokedSessionId, null);
    assert.deepEqual(registry.resolve(sessionId), member);
  });

  it("trims the nickname before matching", () => {
    const registry = new SessionRegistry();

    const first = registry.join("alice");
    const second = registry.join("  alice  ");

    assert.equal(second.member.id, first.member.id);
  });

  it("gives different members different color tags", () => {
    const registry = new SessionRegistry();

    const alice = registry.join("alice").member;
    const bob = registry.join("bob").member;

    assert.notEqual(alice.colorTag, bob.colorTag);
  });

  it("rejects a blank nickname", () => {
    const registry = new SessionRegistry();

    assert.throws(() => registry.join(""), JoinValidationError);
    assert.throws(() => registry.join("   "), JoinValidationError);
    assert.throws(() => registry.join(undefined), JoinValidationError);
  });

  it("rejects a nickname past the length cap", () => {
    const registry = new SessionRegistry();

    assert.throws(() => registry.join("a".repeat(21)), JoinValidationError);
    assert.doesNotThrow(() => registry.join("a".repeat(20)));
  });
});

describe("SessionRegistry takeover (FR-020-08)", () => {
  it("re-enters as the same member, not a second one", () => {
    const registry = new SessionRegistry();

    const laptop = registry.join("alice");
    const phone = registry.join("alice");

    assert.equal(phone.member.id, laptop.member.id);
    assert.equal(phone.member.colorTag, laptop.member.colorTag);
  });

  it("reports the displaced session so the caller can close it", () => {
    const registry = new SessionRegistry();

    const laptop = registry.join("alice");
    const phone = registry.join("alice");

    assert.equal(phone.revokedSessionId, laptop.sessionId);
    assert.notEqual(phone.sessionId, laptop.sessionId);
  });

  it("stops resolving the displaced session", () => {
    const registry = new SessionRegistry();

    const laptop = registry.join("alice");
    const phone = registry.join("alice");

    assert.equal(registry.resolve(laptop.sessionId), null);
    assert.ok(registry.resolve(phone.sessionId));
  });

  it("does not disturb another member's session", () => {
    const registry = new SessionRegistry();

    const bob = registry.join("bob");
    registry.join("alice");
    registry.join("alice");

    assert.deepEqual(registry.resolve(bob.sessionId), bob.member);
  });

  it("survives a third device taking over from the second", () => {
    const registry = new SessionRegistry();

    const laptop = registry.join("alice");
    const phone = registry.join("alice");
    const tablet = registry.join("alice");

    assert.equal(tablet.revokedSessionId, phone.sessionId);
    assert.equal(registry.resolve(laptop.sessionId), null);
    assert.equal(registry.resolve(phone.sessionId), null);
    assert.ok(registry.resolve(tablet.sessionId));
  });
});

describe("SessionRegistry.resolve", () => {
  it("returns null for an unknown or missing session", () => {
    const registry = new SessionRegistry();

    assert.equal(registry.resolve("not-a-session"), null);
    assert.equal(registry.resolve(undefined), null);
  });
});
