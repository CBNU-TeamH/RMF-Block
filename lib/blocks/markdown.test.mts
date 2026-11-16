import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { blocksToMarkdown } from "./markdown.ts";
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
