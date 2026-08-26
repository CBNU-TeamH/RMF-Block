import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { rosterFrom } from "./roster.ts";
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
