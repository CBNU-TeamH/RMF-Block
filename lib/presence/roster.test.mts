import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { occupantsByDocument, rosterFrom, withOffline } from "./roster.ts";
import { HOST_PRESENCE, type WorkspacePresence } from "./types.ts";

const alice: WorkspacePresence = {
  id: "id-alice",
  nickname: "alice",
  colorTag: "#ef4444",
};
const bob: WorkspacePresence = {
  id: "id-bob",
  nickname: "bob",
  colorTag: "#3b82f6",
};

/** Shaped like one entry of `doc.getPresences()`. */
const client = (presence: WorkspacePresence) => ({ presence });

describe("rosterFrom", () => {
  it("is empty when nobody is attached", () => {
    assert.deepEqual(rosterFrom([]), []);
  });

  it("keeps everyone who is attached", () => {
    assert.deepEqual(rosterFrom([client(alice), client(bob)]), [alice, bob]);
  });

  it("preserves the order clients arrived in", () => {
    assert.deepEqual(rosterFrom([client(bob), client(alice)]), [bob, alice]);
  });

  it("lists the host alongside guests", () => {
    assert.deepEqual(rosterFrom([client(HOST_PRESENCE), client(alice)]), [
      HOST_PRESENCE,
      alice,
    ]);
  });
});

describe("rosterFrom collapsing one member's clients", () => {
  it("shows a member with two tabs once", () => {
    // Measured against a real Yorkie server: two clients under one member id
    // are two entries in getPresences(), which is why this collapse exists.
    assert.deepEqual(rosterFrom([client(alice), client(alice)]), [alice]);
  });

  it("collapses a takeover's overlapping clients (FR-020-08)", () => {
    // The phone has attached; the laptop it displaced has not detached yet.
    const laptop = { ...alice };
    const phone = { ...alice };

    assert.deepEqual(rosterFrom([client(laptop), client(phone), client(bob)]), [
      phone,
      bob,
    ]);
  });

  it("does not collapse two members who share a color tag", () => {
    // Color tags are handed out round-robin and repeat past eight members, so
    // identity has to come from the id alone.
    const carol: WorkspacePresence = { ...bob, id: "id-carol", nickname: "carol" };

    assert.deepEqual(rosterFrom([client(bob), client(carol)]).length, 2);
  });
});

describe("rosterFrom with unusable entries", () => {
  it("skips a presence carrying no id", () => {
    const nameless = { nickname: "ghost", colorTag: "#000000" } as WorkspacePresence;

    assert.deepEqual(rosterFrom([client(alice), client(nameless)]), [alice]);
  });

  it("skips several id-less entries rather than merging them into one row", () => {
    const first = { nickname: "one" } as WorkspacePresence;
    const second = { nickname: "two" } as WorkspacePresence;

    assert.deepEqual(rosterFrom([client(first), client(second)]), []);
  });
});

describe("withOffline", () => {
  const carol = { id: "id-carol", nickname: "carol", colorTag: "#22c55e" };
  const at = (documentId: string) => ({ documentId, blockId: null });
  const a = { ...alice, location: at("d1") };
  const b = { ...bob, location: at("d1") };
  const c = { ...carol, location: at("d2") };

  it("lists the viewer first, then those in the document, then the offline", () => {
    const entries = withOffline([b, a], [a, b, carol], "id-alice", "d1");
    assert.deepEqual(
      entries.map((e) => [e.member.id, e.presence !== undefined]),
      [["id-alice", true], ["id-bob", true], ["id-carol", false]],
    );
  });

  it("leaves out a connected member who is in another document", () => {
    const ids = withOffline([a, c], [a, c], "id-alice", "d1").map((e) => e.member.id);
    assert.deepEqual(ids, ["id-alice"]);
  });

  it("lists only the viewer on a page with no document", () => {
    assert.deepEqual(withOffline([a, b], [a, b], "id-alice", null).map((e) => e.member.id), ["id-alice"]);
  });

  it("lists a connected viewer the stored list does not know yet", () => {
    assert.deepEqual(withOffline([a], [], "id-alice", "d1").map((e) => e.member.id), ["id-alice"]);
  });
});

describe("occupantsByDocument", () => {
  it("groups the others by document, skipping the viewer and those with none", () => {
    const a = { ...alice, location: { documentId: "d1", blockId: null } };
    const b = { ...bob, location: { documentId: "d1", blockId: "b1" } };
    const grouped = occupantsByDocument([a, b, { ...HOST_PRESENCE, location: null }], "id-alice");
    assert.deepEqual([...grouped.keys()], ["d1"]);
    assert.deepEqual(grouped.get("d1")?.map((m) => m.id), ["id-bob"]);
  });
});
