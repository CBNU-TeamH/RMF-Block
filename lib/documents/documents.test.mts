import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "vitest";

import {
  DocumentNotFoundError,
  DocumentValidationError,
  createDocument,
  deleteDocument,
  moveDocument,
  readDocuments,
  renameDocument,
} from "./documents.ts";

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

describe("createDocument — under a parent (UC-021 E1a)", () => {
  it("records the parent", () => {
    const storePath = path.join(scratch(), "documents.json");
    const parent = createDocument("기획", "m-1", storePath);

    const child = createDocument("회의록", "m-1", storePath, parent.id);

    assert.equal(child.parentId, parent.id);
  });

  it("lets the same name live under two different parents (FR-021-03)", () => {
    const storePath = path.join(scratch(), "documents.json");
    const a = createDocument("기획", "m-1", storePath);
    const b = createDocument("개발", "m-1", storePath);

    const one = createDocument("회의록", "m-1", storePath, a.id);
    const two = createDocument("회의록", "m-1", storePath, b.id);

    // Workspace-wide uniqueness would have made the second "회의록 (2)".
    assert.equal(one.name, "회의록");
    assert.equal(two.name, "회의록");
  });

  it("still suffixes a repeat under the same parent", () => {
    const storePath = path.join(scratch(), "documents.json");
    const parent = createDocument("기획", "m-1", storePath);

    createDocument("회의록", "m-1", storePath, parent.id);
    const second = createDocument("회의록", "m-1", storePath, parent.id);

    assert.equal(second.name, "회의록 (2)");
  });

  it("refuses a parent that is not there rather than putting it elsewhere", () => {
    const storePath = path.join(scratch(), "documents.json");

    assert.throws(
      () => createDocument("회의록", "m-1", storePath, "no-such-id"),
      DocumentValidationError,
    );
  });
});

describe("renameDocument (FR-023-01/02)", () => {
  it("renames", () => {
    const storePath = path.join(scratch(), "documents.json");
    const d = createDocument("초안", "m-1", storePath);

    assert.equal(renameDocument(d.id, "최종", storePath).name, "최종");
    assert.equal(readDocuments(storePath)[0]!.name, "최종");
  });

  it("refuses a name a sibling already has, where create would suffix it", () => {
    const storePath = path.join(scratch(), "documents.json");
    createDocument("회의록", "m-1", storePath);
    const other = createDocument("초안", "m-1", storePath);

    assert.throws(() => renameDocument(other.id, "회의록", storePath), DocumentValidationError);
  });

  it("allows a name only used under a different parent", () => {
    const storePath = path.join(scratch(), "documents.json");
    const parent = createDocument("기획", "m-1", storePath);
    createDocument("회의록", "m-1", storePath, parent.id);
    const root = createDocument("초안", "m-1", storePath);

    assert.equal(renameDocument(root.id, "회의록", storePath).name, "회의록");
  });

  it("lets a document keep its own name", () => {
    const storePath = path.join(scratch(), "documents.json");
    const d = createDocument("회의록", "m-1", storePath);

    assert.equal(renameDocument(d.id, "회의록", storePath).name, "회의록");
  });

  it("refuses a blank name, and an id that is not there", () => {
    const storePath = path.join(scratch(), "documents.json");
    const d = createDocument("회의록", "m-1", storePath);

    assert.throws(() => renameDocument(d.id, "  ", storePath), DocumentValidationError);
    assert.throws(() => renameDocument("no-such-id", "x", storePath), DocumentNotFoundError);
  });
});

describe("moveDocument (FR-023-03)", () => {
  it("moves under a new parent", () => {
    const storePath = path.join(scratch(), "documents.json");
    const parent = createDocument("기획", "m-1", storePath);
    const child = createDocument("회의록", "m-1", storePath);

    assert.equal(moveDocument(child.id, parent.id, storePath).parentId, parent.id);
  });

  it("moves back to the root", () => {
    const storePath = path.join(scratch(), "documents.json");
    const parent = createDocument("기획", "m-1", storePath);
    const child = createDocument("회의록", "m-1", storePath, parent.id);

    assert.equal(moveDocument(child.id, null, storePath).parentId, null);
  });

  it("suffixes a name its new siblings already hold", () => {
    const storePath = path.join(scratch(), "documents.json");
    const parent = createDocument("기획", "m-1", storePath);
    createDocument("회의록", "m-1", storePath, parent.id);
    const stray = createDocument("회의록", "m-1", storePath);

    assert.equal(moveDocument(stray.id, parent.id, storePath).name, "회의록 (2)");
  });

  it("refuses a move into its own subtree", () => {
    const storePath = path.join(scratch(), "documents.json");
    const parent = createDocument("기획", "m-1", storePath);
    const child = createDocument("회의록", "m-1", storePath, parent.id);

    assert.throws(() => moveDocument(parent.id, child.id, storePath), DocumentValidationError);
    assert.throws(() => moveDocument(parent.id, parent.id, storePath), DocumentValidationError);
  });

  it("refuses a destination that is not there", () => {
    const storePath = path.join(scratch(), "documents.json");
    const d = createDocument("회의록", "m-1", storePath);

    assert.throws(() => moveDocument(d.id, "no-such-id", storePath), DocumentValidationError);
  });
});

describe("deleteDocument (FR-023-04/06)", () => {
  it("removes the document", () => {
    const storePath = path.join(scratch(), "documents.json");
    const d = createDocument("회의록", "m-1", storePath);

    assert.deepEqual(deleteDocument(d.id, storePath), [d.id]);
    assert.deepEqual(readDocuments(storePath), []);
  });

  it("takes the whole subtree with it, in one write", () => {
    const storePath = path.join(scratch(), "documents.json");
    const parent = createDocument("기획", "m-1", storePath);
    const child = createDocument("회의록", "m-1", storePath, parent.id);
    const grandchild = createDocument("메모", "m-1", storePath, child.id);
    const other = createDocument("개발", "m-1", storePath);

    const removed = deleteDocument(parent.id, storePath);

    assert.deepEqual(removed.sort(), [parent.id, child.id, grandchild.id].sort());
    assert.deepEqual(readDocuments(storePath).map((d) => d.id), [other.id]);
  });

  it("leaves a sibling subtree alone", () => {
    const storePath = path.join(scratch(), "documents.json");
    const a = createDocument("A", "m-1", storePath);
    const b = createDocument("B", "m-1", storePath);
    createDocument("a-child", "m-1", storePath, a.id);
    const bChild = createDocument("b-child", "m-1", storePath, b.id);

    deleteDocument(a.id, storePath);

    assert.deepEqual(readDocuments(storePath).map((d) => d.id).sort(), [b.id, bChild.id].sort());
  });

  it("refuses an id that is not there", () => {
    const storePath = path.join(scratch(), "documents.json");

    assert.throws(() => deleteDocument("no-such-id", storePath), DocumentNotFoundError);
  });
});
