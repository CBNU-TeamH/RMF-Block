import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { blocksFromMarkdown } from "./markdown-import.ts";
import { blocksToMarkdown, documentToMarkdown, type MarkdownLinks } from "./markdown.ts";
import { parsePaste } from "./paste.ts";
import type { Block } from "./types.ts";

const ORIGIN = "http://192.168.0.2:3000";
const md = (blocks: Array<Block>) => blocksToMarkdown(blocks, ORIGIN);

describe("blocksToMarkdown", () => {
  it("writes one line per text block, keeping empty ones as the person's spacing", () => {
    assert.equal(
      md([
        { id: "1", type: "heading", level: 2, text: "1. 채용 개요" },
        { id: "2", type: "text", text: "" },
        { id: "3", type: "text", text: "**채용 신분:** 정규직" },
        { id: "4", type: "quote", text: "인용" },
      ]),
      "## 1. 채용 개요\n\n**채용 신분:** 정규직\n> 인용",
    );
  });

  it("numbers ordered items, nests by depth and writes checklists in GFM", () => {
    assert.equal(
      md([
        { id: "1", type: "list", style: "ordered", depth: 0, text: "one" },
        { id: "2", type: "list", style: "unordered", depth: 1, text: "child" },
        { id: "3", type: "list", style: "ordered", depth: 0, text: "two" },
        { id: "4", type: "checklist", checked: true, text: "done" },
        { id: "5", type: "checklist", checked: false, text: "todo" },
      ]),
      "1. one\n    - child\n2. two\n- [x] done\n- [ ] todo",
    );
  });

  it("keeps a numbered item's number when only part of the list is copied", () => {
    const list: Array<Block> = ["a", "b", "c"].map((text, i) => ({ id: `${i}`, type: "list", style: "ordered", depth: 0, text }));
    assert.equal(blocksToMarkdown(list, ORIGIN, new Set(["1", "2"])), "2. b\n3. c");
  });

  it("opens a selection that starts inside a nested list at the left margin", () => {
    assert.equal(
      md([
        { id: "1", type: "list", style: "unordered", depth: 2, text: "a" },
        { id: "2", type: "list", style: "unordered", depth: 4, text: "b" },
        { id: "3", type: "list", style: "unordered", depth: 2, text: "c" },
      ]),
      "- a\n    - b\n- c",
    );
  });

  it("fences code with more backticks than it contains", () => {
    assert.equal(md([{ id: "1", type: "code", text: "a ``` b" }]), "````\na ``` b\n````");
    assert.equal(md([{ id: "1", type: "code", text: "x" }]), "```\nx\n```");
  });

  it("writes a table with its first row as the header, escaping pipes and newlines", () => {
    assert.equal(
      md([
        {
          id: "t",
          type: "table",
          rows: ["r1", "r2"],
          columns: ["c1", "c2"],
          cells: { r1_c1: "이름", r1_c2: "값", r2_c1: "a|b", r2_c2: "x\ny" },
        },
      ]),
      "| 이름 | 값 |\n| --- | --- |\n| a\\|b | x<br>y |",
    );
  });

  it("links embeds and documents at this workspace's address", () => {
    assert.equal(
      md([
        { id: "1", type: "divider" },
        { id: "2", type: "image", fileId: "f1", fileName: "a.png", size: 1 },
        { id: "3", type: "file", fileId: "f2", fileName: "b.docx", fileType: "docx", size: 1 },
        { id: "4", type: "doc-link", documentId: "d1" },
        { id: "5", type: "block-link", documentId: "d1", blockId: "b9" },
      ]),
      [
        "---",
        `![a.png](${ORIGIN}/api/files/f1/preview)`,
        `[b.docx](${ORIGIN}/api/files/f2/download)`,
        `${ORIGIN}/documents/d1`,
        `${ORIGIN}/documents/d1#block=b9`,
      ].join("\n"),
    );
  });

  it("round-trips the line-per-block types through a paste", () => {
    const blocks: Array<Block> = [
      { id: "1", type: "heading", level: 1, text: "제목" },
      { id: "2", type: "list", style: "unordered", depth: 0, text: "item" },
      { id: "3", type: "text", text: "plain" },
    ];
    assert.deepEqual(
      parsePaste(md(blocks)).map(({ fields, text }) => ({ type: fields.type, text })),
      [
        { type: "heading", text: "제목" },
        { type: "list", text: "item" },
        { type: "text", text: "plain" },
      ],
    );
  });
});

describe("documentToMarkdown", () => {
  const links: MarkdownLinks = {
    file: (fileId) => (fileId === "f1" ? "회의록/도표 [1].png" : null),
    document: (documentId) => (documentId === "d2" ? { path: "회의록/하위 [안].md", name: "하위 [안]" } : null),
  };

  it("puts a blank line between blocks but keeps a list together", () => {
    assert.equal(
      documentToMarkdown(
        [
          { id: "1", type: "heading", level: 1, text: "제목" },
          { id: "2", type: "list", style: "unordered", depth: 0, text: "a" },
          { id: "3", type: "checklist", checked: false, text: "b" },
          { id: "4", type: "text", text: "끝" },
        ],
        ORIGIN,
        links,
      ),
      "# 제목\n\n- a\n- [ ] b\n\n끝",
    );
  });

  it("points files and exported documents at their paths, and drops a missing file's link", () => {
    assert.deepEqual(
      documentToMarkdown(
        [
          { id: "1", type: "image", fileId: "f1", fileName: "도표 [1].png", size: 1 },
          { id: "2", type: "file", fileId: "gone", fileName: "옛 파일.docx", fileType: "x", size: 1 },
          { id: "3", type: "doc-link", documentId: "d2" },
          { id: "4", type: "block-link", documentId: "d2", blockId: "b9" },
          { id: "5", type: "doc-link", documentId: "elsewhere" },
        ],
        ORIGIN,
        links,
      ).split("\n\n"),
      [
        "![도표 \\[1\\].png](<회의록/도표 [1].png>)",
        "옛 파일.docx",
        "[하위 \\[안\\]](<회의록/하위 [안].md>)",
        "[하위 \\[안\\]](<회의록/하위 [안].md>)",
        `${ORIGIN}/documents/elsewhere`,
      ],
    );
  });

  it("encodes %, # and & in a path, which a reader would take as an escape, a fragment and an entity", () => {
    assert.equal(
      documentToMarkdown([{ id: "1", type: "file", fileId: "f1", fileName: "50% #3 &copy;.txt", fileType: "x", size: 1 }], ORIGIN, {
        file: () => "문서/50% #3 &copy;.txt",
        document: () => null,
      }),
      "[50% #3 &copy;.txt](<문서/50%25 %233 %26copy;.txt>)",
    );
  });

  it("reads back through the import as the same blocks", () => {
    const blocks: Array<Block> = [
      { id: "1", type: "heading", level: 2, text: "제목" },
      { id: "2", type: "text", text: "본문" },
      { id: "3", type: "list", style: "ordered", depth: 0, text: "하나" },
      { id: "4", type: "list", style: "ordered", depth: 0, text: "둘" },
      { id: "5", type: "quote", text: "인용" },
      { id: "6", type: "code", text: "x = 1" },
      { id: "7", type: "divider" },
    ];
    const strip = (list: Array<Block>) => list.map((block) => ({ ...block, id: "" }));

    assert.deepEqual(strip(blocksFromMarkdown(documentToMarkdown(blocks, ORIGIN, links))), strip(blocks));
  });
});
