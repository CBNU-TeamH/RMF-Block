import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { SessionRegistry } from "./session-registry.ts";
import { JoinValidationError, MemberStoreError, WorkspaceFullError } from "./types.ts";

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

describe("SessionRegistry capacity", () => {
  const fill = (registry: SessionRegistry, count: number) => {
    for (let i = 0; i < count; i += 1) registry.join(`member-${i}`);
  };

  it("refuses a new nickname once the workspace is full", () => {
    const registry = new SessionRegistry();
    fill(registry, 64);

    assert.throws(() => registry.join("one-too-many"), WorkspaceFullError);
  });

  it("still lets an existing member back in when full", () => {
    // A returning device must not be turned away by a ceiling meant for abuse —
    // this is the case that makes the order of the check matter.
    const registry = new SessionRegistry();
    fill(registry, 64);

    const again = registry.join("member-0");
    assert.equal(again.member.nickname, "member-0");
    assert.ok(registry.resolve(again.sessionId));
  });
});

describe("SessionRegistry.hasLiveSession", () => {
  it("is false for a nickname nobody has used", () => {
    const registry = new SessionRegistry();

    assert.equal(registry.hasLiveSession("alice"), false);
    assert.equal(registry.hasLiveSession(""), false);
    assert.equal(registry.hasLiveSession(undefined), false);
  });

  it("is true while that member holds a valid session", () => {
    const registry = new SessionRegistry();
    registry.join("alice");

    assert.equal(registry.hasLiveSession("alice"), true);
    assert.equal(registry.hasLiveSession("  alice  "), true);
  });

  it("stays true after a takeover, because the new session is live too", () => {
    // The point of the flag is "would this throw someone out", and after a
    // takeover the answer is still yes — just a different device.
    const registry = new SessionRegistry();
    registry.join("alice");
    registry.join("alice");

    assert.equal(registry.hasLiveSession("alice"), true);
  });

  it("does not confuse one member's live session for another's", () => {
    const registry = new SessionRegistry();
    registry.join("alice");

    assert.equal(registry.hasLiveSession("bob"), false);
  });
});

describe("SessionRegistry persistence", () => {
  const scratch = () =>
    path.join(mkdtempSync(path.join(tmpdir(), "rmf-members-")), "members.json");

  it("keeps nothing on disk when no store path is given", () => {
    // The default constructor is the unit-test shape: a registry that forgets.
    const registry = new SessionRegistry();
    registry.join("alice");

    assert.deepEqual(registry.members().length, 1);
  });

  it("gives a returning nickname back its id and colour tag", () => {
    const storePath = scratch();

    const first = new SessionRegistry(storePath).join("alice").member;
    // A second registry over the same file is what a restart looks like.
    const second = new SessionRegistry(storePath).join("alice").member;

    assert.equal(second.id, first.id);
    assert.equal(second.colorTag, first.colorTag);
  });

  it("does not restore sessions, only members", () => {
    const storePath = scratch();

    const before = new SessionRegistry(storePath).join("alice");
    const after = new SessionRegistry(storePath);

    assert.equal(after.resolve(before.sessionId), null);
    assert.equal(after.hasLiveSession("alice"), false);
  });

  it("keeps handing out fresh colour tags after a restart", () => {
    // The rotation counts members, so a restart that lost them would restart the
    // colours too and hand the second member the first one's tag.
    const storePath = scratch();

    const alice = new SessionRegistry(storePath).join("alice").member;
    const bob = new SessionRegistry(storePath).join("bob").member;

    assert.notEqual(bob.colorTag, alice.colorTag);
  });

  it("stamps lastJoinedAt on every join, not just the first", async () => {
    const storePath = scratch();

    const registry = new SessionRegistry(storePath);
    registry.join("alice");
    const first = registry.members()[0]!.lastJoinedAt;

    await new Promise((resolve) => setTimeout(resolve, 5));
    registry.join("alice");

    assert.ok(registry.members()[0]!.lastJoinedAt > first);
  });

  it("counts persisted members against the capacity ceiling", () => {
    const storePath = scratch();

    const first = new SessionRegistry(storePath);
    for (let i = 0; i < 64; i += 1) first.join(`member-${i}`);

    assert.throws(() => new SessionRegistry(storePath).join("one-too-many"), WorkspaceFullError);
  });

  it("treats a missing store as an empty workspace, not an error", () => {
    assert.doesNotThrow(() => new SessionRegistry(scratch()));
  });
});

describe("SessionRegistry when the store cannot be written", () => {
  /**
   * A path whose parent refuses `mkdir`, so `writeMembers` throws.
   *
   * `sealed` reports whether the mode actually took: root ignores 0o500 and
   * Windows does not enforce POSIX bits, and a test that cannot fail is worse
   * than no test — which this file has already learned once, from a case that
   * sealed the wrong directory and asserted nothing.
   */
  const unwritable = () => {
    const dir = mkdtempSync(path.join(tmpdir(), "rmf-ro-"));
    const storePath = path.join(dir, "sub", "members.json");
    const seal = () => {
      chmodSync(dir, 0o500);
      try {
        writeFileSync(path.join(dir, ".probe"), "");
        return false;
      } catch {
        return true;
      }
    };
    return { storePath, seal, open: () => chmodSync(dir, 0o700) };
  };

  it("rolls a first-time join back rather than stranding a session", () => {
    // The bug this pins: leaving the mutations in place made hasLiveSession()
    // report the nickname as taken, so the guest met a 409 telling them to
    // displace a device that did not exist, and the name stayed locked.
    const { storePath, seal, open } = unwritable();
    const registry = new SessionRegistry(storePath);
    if (!seal()) return; // the filesystem will not hold the door shut here

    try {
      assert.throws(() => registry.join("alice"), MemberStoreError);
      assert.equal(registry.hasLiveSession("alice"), false);
      assert.equal(registry.members().length, 0);
    } finally {
      open();
    }
  });

  it("lets the nickname straight back in once the store recovers", () => {
    const { storePath, seal, open } = unwritable();
    const registry = new SessionRegistry(storePath);
    if (!seal()) return;
    assert.throws(() => registry.join("alice"), MemberStoreError);
    open();

    const again = registry.join("alice");
    assert.equal(again.member.nickname, "alice");
    assert.ok(registry.resolve(again.sessionId));
  });

  it("lets a returning member through, because their record is already on disk", () => {
    // All a failed write costs them is a fresher lastJoinedAt, which is not
    // worth turning away a guest whose identity is already durable.
    //
    // The first join has to land before the store is sealed, so the directory
    // it created has to be the one sealed — sealing only the parent leaves the
    // second write perfectly able to succeed, and the test proves nothing.
    const dir = mkdtempSync(path.join(tmpdir(), "rmf-ro-"));
    const storePath = path.join(dir, "members.json");
    const registry = new SessionRegistry(storePath);
    const first = registry.join("alice");
    const before = readFileSync(storePath, "utf8");
    chmodSync(dir, 0o500);
    try {
      writeFileSync(path.join(dir, ".probe"), "");
      chmodSync(dir, 0o700);
      return; // not enforced here — see `unwritable`
    } catch {
      // sealed, carry on
    }

    try {
      const second = registry.join("alice");
      assert.equal(second.member.id, first.member.id);
      assert.equal(second.revokedSessionId, first.sessionId);
      assert.ok(registry.resolve(second.sessionId));
      // And the write really did fail — otherwise this asserts nothing.
      assert.equal(readFileSync(storePath, "utf8"), before);
    } finally {
      chmodSync(dir, 0o700);
    }
  });
});
