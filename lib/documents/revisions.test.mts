import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  REVISION_PAGE_SIZE,
  beforeRestoreLabel,
  classifyRevision,
  groupRevisionsByDay,
  isOldestPage,
  restoredFrom,
  toRevisionEntries,
} from "./revisions.ts";

const at = (iso: string) => new Date(iso);

const summary = (label: string, iso = "2026-09-22T02:40:53.673Z") => ({
  id: label,
  label,
  description: "",
  createdAt: at(iso),
});

describe("classifyRevision", () => {
  it("reads Yorkie's own label as automatic", () => {
    // The exact spelling measured against 0.7.13, not a guess.
    assert.equal(classifyRevision("snapshot-27"), "automatic");
    assert.equal(classifyRevision("snapshot-1"), "automatic");
  });

  it("reads the app's own prefix as before-restore", () => {
    assert.equal(classifyRevision(beforeRestoreLabel("abc123")), "before-restore");
  });

  it("reads anything else as named", () => {
    for (const label of ["제출 전 최종", "v1", "snapshot", "snapshot-", "snapshot-1a", ""]) {
      assert.equal(classifyRevision(label), "named", JSON.stringify(label));
    }
  });

  it("does not read a user's label as automatic just because it starts that way", () => {
    // `snapshot-27 (검토본)` is a name someone could plausibly type.
    assert.equal(classifyRevision("snapshot-27 (검토본)"), "named");
  });
});

describe("restoredFrom", () => {
  it("recovers the revision a before-restore entry points at", () => {
    assert.equal(restoredFrom(beforeRestoreLabel("abc123")), "abc123");
  });

  it("is null for any other kind, and for a prefix with nothing after it", () => {
    assert.equal(restoredFrom("snapshot-3"), null);
    assert.equal(restoredFrom("제출 전"), null);
    assert.equal(restoredFrom(beforeRestoreLabel("")), null);
  });
});

describe("toRevisionEntries", () => {
  it("orders newest first whatever order they arrive in", () => {
    const entries = toRevisionEntries([
      summary("older", "2026-09-22T01:00:00.000Z"),
      summary("newest", "2026-09-22T03:00:00.000Z"),
      summary("middle", "2026-09-22T02:00:00.000Z"),
    ]);

    assert.deepEqual(
      entries.map((entry) => entry.label),
      ["newest", "middle", "older"],
    );
  });

  it("keeps every revision it is handed", () => {
    // No ceiling on purpose. `listRevisions` pages to the very first revision,
    // so truncating here would hide history that is still reachable.
    const many = Array.from({ length: REVISION_PAGE_SIZE * 4 + 1 }, (_, index) =>
      summary(`snapshot-${index}`, new Date(1_800_000_000_000 + index * 1000).toISOString()),
    );

    assert.equal(toRevisionEntries(many).length, many.length);
  });

  it("carries the kind onto every entry", () => {
    const entries = toRevisionEntries([summary("snapshot-4"), summary("제출 전")]);

    assert.deepEqual(
      entries.map((entry) => entry.kind).sort(),
      ["automatic", "named"],
    );
  });
});

describe("groupRevisionsByDay", () => {
  it("groups by the workspace's own day, not the runner's", () => {
    // 2026-09-22T15:30Z is still the 22nd in UTC and already the 23rd in Seoul
    // (UTC+9). This is the assertion that fails if the zone is ever left to the
    // machine, which in the container would be UTC.
    const entries = toRevisionEntries([
      summary("late", "2026-09-22T15:30:00.000Z"),
      summary("early", "2026-09-22T01:00:00.000Z"),
    ]);

    const days = groupRevisionsByDay(entries);

    assert.equal(days.length, 2);
    assert.equal(days[0].day, "2026년 9월 23일");
    assert.equal(days[1].day, "2026년 9월 22일");
  });

  it("puts revisions from one day in one group, in the order given", () => {
    const entries = toRevisionEntries([
      summary("a", "2026-09-22T03:00:00.000Z"),
      summary("b", "2026-09-22T02:00:00.000Z"),
      summary("c", "2026-09-22T01:00:00.000Z"),
    ]);

    const days = groupRevisionsByDay(entries);

    assert.equal(days.length, 1);
    assert.deepEqual(
      days[0].entries.map((entry) => entry.label),
      ["a", "b", "c"],
    );
  });

  it("returns nothing for nothing", () => {
    assert.deepEqual(groupRevisionsByDay([]), []);
  });
});

describe("isOldestPage", () => {
  it("is true only for a page shorter than a full one", () => {
    // The measured end-of-list signal: a full page means ask again, a short
    // page means this was the last, and past the end Yorkie returns nothing.
    assert.equal(isOldestPage(new Array(REVISION_PAGE_SIZE)), false);
    assert.equal(isOldestPage(new Array(REVISION_PAGE_SIZE - 1)), true);
    assert.equal(isOldestPage([]), true);
  });
});
