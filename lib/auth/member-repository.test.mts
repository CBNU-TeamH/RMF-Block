import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { readMembers, writeMembers } from "./member-repository.ts";

const scratch = () => mkdtempSync(path.join(tmpdir(), "rmf-member-repo-"));

const member = {
  id: "m-1",
  nickname: "alice",
  colorTag: "#ef4444",
  lastJoinedAt: "2026-08-26T00:00:00.000Z",
};

describe("member repository", () => {
  it("round-trips a member", () => {
    const storePath = path.join(scratch(), "members.json");

    writeMembers(storePath, [member]);

    assert.deepEqual(readMembers(storePath), [member]);
  });

  it("creates the directory it is pointed at", () => {
    const storePath = path.join(scratch(), "nested", "members.json");

    assert.doesNotThrow(() => writeMembers(storePath, [member]));
  });

  it("reads a missing store as an empty workspace", () => {
    assert.deepEqual(readMembers(path.join(scratch(), "nothing-here.json")), []);
  });

  it("does not swallow a read error that is not a missing file", () => {
    // The distinction is load-bearing: returning [] for a permission or disk
    // error would make the next write persist one member and destroy the rest.
    // A directory stands in for "readable path, unreadable content".
    assert.throws(() => readMembers(scratch()));
  });

  it("leaves no temp file behind", () => {
    const dir = scratch();
    const storePath = path.join(dir, "members.json");

    writeMembers(storePath, [member]);

    assert.throws(() => readFileSync(`${storePath}.tmp`, "utf8"));
  });
});
