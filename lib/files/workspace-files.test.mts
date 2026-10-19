import assert from "node:assert/strict";
import { describe, it } from "vitest";

import type { ChatMessage } from "../chat/types.ts";
import type { StoredFile } from "./types.ts";
import { workspaceFiles } from "./workspace-files.ts";

const documents = [
  { id: "doc-a", name: "회의록" },
  { id: "doc-b", name: "예산" },
];

const stored = (id: string, type: string, uploadedAt: string, extra: Partial<StoredFile> = {}): StoredFile => ({
  id,
  name: `${id}.bin`,
  type,
  size: 10,
  uploadedBy: "민수",
  uploadedAt,
  origin: "document",
  ...extra,
});

/** A root the way Yorkie's `GetDocuments` returns it (measured on 0.7.23). */
const root = (...blocks: Array<object | null>) => JSON.stringify({ blocks });
const fileBlock = (id: string, type: string, fileId: string) => ({ id, type, content: { fileId } });

describe("workspaceFiles — document files", () => {
  it("places a file at the live block that holds it, with its document's name", () => {
    const listed = workspaceFiles({
      documents,
      roots: new Map([["doc-a", root({ id: "b0", type: "text", content: { text: [{ val: "hi" }] } }, fileBlock("b1", "image", "f1"))]]),
      files: [stored("f1", "image/png", "2026-10-16T00:00:00Z")],
      messages: [],
    });

    assert.deepEqual(listed[0]?.source, { kind: "document", documentId: "doc-a", documentName: "회의록", blockId: "b1" });
    assert.equal(listed[0]?.kind, "image");
  });

  it("leaves out a file no live block holds — its block was deleted (FR-050-06)", () => {
    const listed = workspaceFiles({
      documents,
      roots: new Map([["doc-a", root({ id: "b0", type: "text" })]]),
      files: [stored("gone", "application/pdf", "2026-10-16T00:00:00Z", { documentId: "doc-a" })],
      messages: [],
    });

    assert.deepEqual(listed, []);
  });

  it("leaves out a file whose document Yorkie did not return (trashed, or never opened)", () => {
    const listed = workspaceFiles({
      documents,
      roots: new Map([["doc-b", root()]]),
      files: [stored("f1", "image/png", "2026-10-16T00:00:00Z", { documentId: "doc-a" })],
      messages: [],
    });

    assert.deepEqual(listed, []);
  });

  it("places a file uploaded before documentId was recorded, from the documents alone", () => {
    const listed = workspaceFiles({
      documents,
      roots: new Map([["doc-b", root(fileBlock("b9", "file", "old"))]]),
      files: [stored("old", "application/zip", "2026-09-01T00:00:00Z")],
      messages: [],
    });

    assert.equal(listed[0]?.source.kind === "document" && listed[0].source.documentName, "예산");
    assert.equal(listed[0]?.kind, "document");
  });

  it("lists a file held by two blocks once, at the first", () => {
    const listed = workspaceFiles({
      documents,
      roots: new Map([
        ["doc-a", root(fileBlock("b1", "pdf", "f1"))],
        ["doc-b", root(fileBlock("b2", "pdf", "f1"))],
      ]),
      files: [stored("f1", "application/pdf", "2026-10-16T00:00:00Z")],
      messages: [],
    });

    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.source.kind === "document" && listed[0].source.blockId, "b1");
  });

  it("skips a root that is not the editor's shape instead of failing", () => {
    const listed = workspaceFiles({
      documents,
      roots: new Map([
        ["doc-a", "not json"],
        ["doc-b", root(fileBlock("b2", "image", "f2"), { id: "b3", type: "image", content: { fileId: 7 } }, null)],
      ]),
      files: [stored("f2", "image/jpeg", "2026-10-16T00:00:00Z")],
      messages: [],
    });

    assert.deepEqual(listed.map((file) => file.fileId), ["f2"]);
  });

  it("lists no document file at all when Yorkie could not be read", () => {
    const listed = workspaceFiles({
      documents,
      roots: null,
      files: [stored("f1", "image/png", "2026-10-16T00:00:00Z")],
      messages: [],
    });

    assert.deepEqual(listed, []);
  });
});

describe("workspaceFiles — chat files and order", () => {
  const message = (id: string, sentAt: string, fileType: string): ChatMessage => ({
    id,
    sender: "지은",
    text: "",
    sentAt,
    attachment: { fileId: `file-${id}`, fileName: `${id}.bin`, fileType, size: 5 },
  });

  it("lists every chat attachment with its message, sender and time", () => {
    const listed = workspaceFiles({
      documents,
      roots: null,
      files: [],
      messages: [message("m1", "2026-10-15T00:00:00Z", "application/pdf"), { id: "m2", sender: "x", text: "hi", sentAt: "2026-10-15T01:00:00Z" }],
    });

    assert.deepEqual(listed, [
      {
        fileId: "file-m1",
        name: "m1.bin",
        type: "application/pdf",
        size: 5,
        uploadedBy: "지은",
        uploadedAt: "2026-10-15T00:00:00Z",
        kind: "pdf",
        source: { kind: "chat", messageId: "m1" },
      },
    ]);
  });

  it("puts document and chat files together, newest first", () => {
    const listed = workspaceFiles({
      documents,
      roots: new Map([["doc-a", root(fileBlock("b1", "image", "f1"), fileBlock("b2", "image", "f2"))]]),
      files: [stored("f1", "image/png", "2026-10-10T00:00:00Z"), stored("f2", "image/png", "2026-10-14T00:00:00Z")],
      messages: [message("m1", "2026-10-12T00:00:00Z", "image/png")],
    });

    assert.deepEqual(listed.map((file) => file.fileId), ["f2", "file-m1", "f1"]);
  });
});
