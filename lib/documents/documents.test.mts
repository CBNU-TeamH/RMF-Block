import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { DocumentValidationError, createDocument, readDocuments } from "./documents.ts";

const scratch = () => mkdtempSync(path.join(tmpdir(), "rmf-docs-"));

const store = (documents: unknown) => {
  const storePath = path.join(scratch(), "documents.json");
  writeFileSync(storePath, JSON.stringify(documents));
  return storePath;
};

const doc = (id: string, updatedAt: string) => ({
  id,
  name: id,
  createdBy: "m-1",
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

describe("createDocument", () => {
  it("adds a document that a later readDocuments sees", () => {
    const storePath = path.join(scratch(), "documents.json");

    const created = createDocument("회의록", "m-1", storePath);

    assert.equal(created.createdBy, "m-1");
    assert.deepEqual(readDocuments(storePath).map((d) => d.id), [created.id]);
  });

  it("refuses an empty or blank name (#UC-021)", () => {
    const storePath = path.join(scratch(), "documents.json");

    assert.throws(() => createDocument("", "m-1", storePath), DocumentValidationError);
    assert.throws(() => createDocument("   ", "m-1", storePath), DocumentValidationError);
    assert.throws(() => createDocument(undefined, "m-1", storePath), DocumentValidationError);
  });

  it("trims the name", () => {
    const storePath = path.join(scratch(), "documents.json");

    const created = createDocument("  회의록  ", "m-1", storePath);

    assert.equal(created.name, "회의록");
  });

  it("gives a repeated name a disambiguating suffix instead of refusing it (E4a)", () => {
    const storePath = path.join(scratch(), "documents.json");

    createDocument("회의록", "m-1", storePath);
    const second = createDocument("회의록", "m-2", storePath);
    const third = createDocument("회의록", "m-1", storePath);

    assert.equal(second.name, "회의록 (2)");
    assert.equal(third.name, "회의록 (3)");
  });

  it("never reuses an id, even for the same name", () => {
    const storePath = path.join(scratch(), "documents.json");

    const a = createDocument("회의록", "m-1", storePath);
    const b = createDocument("회의록", "m-1", storePath);

    assert.notEqual(a.id, b.id);
  });
});
