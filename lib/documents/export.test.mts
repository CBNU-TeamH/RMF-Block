import assert from "node:assert/strict";
import { describe, it } from "vitest";

import type { Block } from "../blocks/types.ts";
import { planExport, safeName, type ExportDocument } from "./export.ts";
import { subtreeIds } from "./tree.ts";

const ORIGIN = "http://192.168.0.2:3000";

const text = (id: string, value: string): Block => ({ id, type: "text", text: value });
const image = (id: string, fileId: string, fileName: string): Block => ({ id, type: "image", fileId, fileName, size: 1 });

function plan(
  documents: Array<ExportDocument>,
  blocks: Record<string, Array<Block>>,
  { includeSubpages = true, files = ["f1", "f2", "f3"] } = {},
) {
  const rootId = documents[0]!.id;
  return planExport({
    documents,
    ids: includeSubpages ? subtreeIds(documents, rootId) : [rootId],
    blocks: new Map(Object.entries(blocks)),
    hasFile: (fileId) => files.includes(fileId),
    origin: ORIGIN,
  });
}

const entriesOf = (result: ReturnType<typeof plan>) => {
  assert.equal(result.kind, "zip");
  return result.kind === "zip" ? result.entries : [];
};
const paths = (result: ReturnType<typeof plan>) => entriesOf(result).map((entry) => entry.path);
const textOf = (result: ReturnType<typeof plan>, path: string) => {
  const entry = entriesOf(result).find((candidate) => candidate.path === path);
  return entry && "text" in entry ? entry.text : undefined;
};

describe("planExport", () => {
  it("is one .md for a document with no files and no sub-pages", () => {
    const result = plan([{ id: "a", name: "회의록" }], { a: [text("1", "본문")] });

    assert.deepEqual(result, { kind: "markdown", fileName: "회의록.md", text: "본문" });
  });

  it("zips the .md with its images in a folder named after it", () => {
    const result = plan([{ id: "a", name: "회의록" }], { a: [image("1", "f1", "도표.png")] });

    assert.equal(result.fileName, "회의록.zip");
    assert.deepEqual(entriesOf(result), [
      { path: "회의록.md", text: "![도표.png](<회의록/도표.png>)" },
      { path: "회의록/도표.png", fileId: "f1" },
    ]);
  });

  it("writes a file whose bytes are gone as its name, and leaves it out", () => {
    const result = plan([{ id: "a", name: "회의록" }], { a: [image("1", "gone", "옛 도표.png")] });

    assert.deepEqual(result, { kind: "markdown", fileName: "회의록.md", text: "옛 도표.png" });
  });

  const tree: Array<ExportDocument> = [
    { id: "a", name: "프로젝트" },
    { id: "b", name: "회의", parentId: "a" },
    { id: "c", name: "1차", parentId: "b" },
    { id: "other", name: "다른 문서" },
  ];

  it("mirrors the hierarchy in folders and links exported documents relatively", () => {
    const result = plan(tree, {
      a: [{ id: "1", type: "doc-link", documentId: "c" }],
      b: [image("2", "f1", "a.png")],
      c: [
        { id: "3", type: "doc-link", documentId: "a" },
        image("4", "f1", "a.png"),
        { id: "5", type: "doc-link", documentId: "other" },
      ],
    });

    assert.equal(result.fileName, "프로젝트.zip");
    assert.deepEqual(paths(result), ["프로젝트.md", "프로젝트/회의.md", "프로젝트/회의/1차.md", "프로젝트/회의/a.png"]);
    assert.equal(textOf(result, "프로젝트.md"), "[1차](<프로젝트/회의/1차.md>)");
    // The same file twice is stored once, in the first document's folder.
    assert.equal(
      textOf(result, "프로젝트/회의/1차.md"),
      `[프로젝트](<../../프로젝트.md>)\n\n![a.png](<a.png>)\n\n${ORIGIN}/documents/other`,
    );
  });

  it("exports the document alone without sub-pages, linking them by address", () => {
    const result = plan(tree, { a: [{ id: "1", type: "doc-link", documentId: "b" }] }, { includeSubpages: false });

    assert.deepEqual(result, { kind: "markdown", fileName: "프로젝트.md", text: `${ORIGIN}/documents/b` });
  });

  it("numbers names that repeat in one folder, ignoring case, and keeps a sub-page's folder free", () => {
    const result = plan(
      [
        { id: "a", name: "루트" },
        { id: "b", name: "Notes", parentId: "a" },
        { id: "c", name: "notes", parentId: "a" },
      ],
      {
        a: [image("1", "f1", "Notes"), image("2", "f2", "x.png"), image("3", "f3", "X.png")],
        b: [],
        c: [],
      },
    );

    assert.deepEqual(paths(result), [
      "루트.md",
      "루트/Notes.md",
      "루트/notes (2).md",
      "루트/Notes (3)",
      "루트/x.png",
      "루트/X (2).png",
    ]);
  });

  it("treats a name's composed and decomposed Unicode forms as the same name", () => {
    const composed = "회의.png";
    const result = plan([{ id: "a", name: "루트" }], {
      a: [image("1", "f1", composed), image("2", "f2", composed.normalize("NFD"))],
    });

    assert.deepEqual(paths(result), ["루트.md", `루트/${composed}`, `루트/${"회의 (2)".normalize("NFD")}.png`]);
  });
});

describe("safeName", () => {
  it("replaces what Windows refuses and trims what it strips", () => {
    assert.equal(safeName('회의록 11/25: "초안"?'), "회의록 11_25_ _초안__");
    assert.equal(safeName("끝에 점.. "), "끝에 점");
    assert.equal(safeName("  "), "제목 없음");
    assert.equal(safeName("CON"), "_CON");
    assert.equal(safeName("con.txt"), "_con.txt");
    assert.equal(safeName("console"), "console");
  });
});
