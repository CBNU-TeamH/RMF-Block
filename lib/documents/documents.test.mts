import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { readDocuments } from "./documents.ts";

const scratch = () => mkdtempSync(path.join(tmpdir(), "rmf-docs-"));

const store = (documents: unknown) => {
  const storePath = path.join(scratch(), "documents.json");
  writeFileSync(storePath, JSON.stringify(documents));
  return storePath;
};

const doc = (id: string, updatedAt: string) => ({
  id,
  name: id,
  ownerId: "m-1",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt,
});

describe("readDocuments", () => {
  it("reads a missing store as an empty workspace", () => {
    assert.deepEqual(readDocuments(path.join(scratch(), "none.json")), []);
  });

  it("does not swallow a read error that is not a missing file", () => {
    // Returning [] for a permission or disk error would render an empty
    // workspace over documents that are really there.
    assert.throws(() => readDocuments(scratch()));
  });

  it("returns the newest edit first", () => {
    const storePath = store([
      doc("older", "2026-08-01T00:00:00.000Z"),
      doc("newest", "2026-08-26T00:00:00.000Z"),
      doc("middle", "2026-08-10T00:00:00.000Z"),
    ]);

    assert.deepEqual(readDocuments(storePath).map((d) => d.id), ["newest", "middle", "older"]);
  });
});
