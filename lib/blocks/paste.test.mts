import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { parsePaste } from "./paste.ts";

const types = (text: string) => parsePaste(text).map((line) => line.fields.type);
const texts = (text: string) => parsePaste(text).map((line) => line.text);

describe("parsePaste — splitting", () => {
  it("returns one entry for one line, so a caller always has something to place", () => {
    assert.deepEqual(parsePaste("hello"), [{ fields: { type: "text" }, text: "hello" }]);
  });

  it("returns one entry for the empty string rather than nothing", () => {
    assert.equal(parsePaste("").length, 1);
  });

  it("splits on newlines", () => {
    assert.deepEqual(texts("a\nb\nc"), ["a", "b", "c"]);
  });

  it("treats CRLF the same as LF", () => {
    assert.deepEqual(texts("a\r\nb"), ["a", "b"]);
    assert.deepEqual(texts("a\rb"), ["a", "b"]);
  });

  it("drops one trailing newline — a copied paragraph ends with it", () => {
    assert.deepEqual(texts("a\nb\n"), ["a", "b"]);
  });

  it("keeps a blank line between two lines, which is the person's own spacing", () => {
    assert.deepEqual(texts("a\n\nb"), ["a", "", "b"]);
  });

  it("keeps a blank line that a trailing newline follows", () => {
    assert.deepEqual(texts("a\n\n"), ["a", ""]);
  });
});

describe("parsePaste — markers", () => {
  it("converts a heading and keeps the rest as its text", () => {
    assert.deepEqual(parsePaste("# Title"), [
      { fields: { type: "heading", level: 1 }, text: "Title" },
    ]);
    assert.deepEqual(parsePaste("### Small")[0]!.fields, { type: "heading", level: 3 });
  });

  it("converts both list styles", () => {
    assert.deepEqual(parsePaste("- one")[0], {
      fields: { type: "list", style: "unordered", depth: 0 },
      text: "one",
    });
    assert.deepEqual(parsePaste("1. one")[0]!.fields, { type: "list", style: "ordered", depth: 0 });
    assert.deepEqual(parsePaste("* one")[0]!.fields, { type: "list", style: "unordered", depth: 0 });
  });

  it("carries a checklist's checked state, which typing the marker cannot", () => {
    assert.deepEqual(parsePaste("[ ] todo")[0], {
      fields: { type: "checklist", checked: false },
      text: "todo",
    });
    assert.deepEqual(parsePaste("[x] done")[0], {
      fields: { type: "checklist", checked: true },
      text: "done",
    });
  });

  it("converts a quote", () => {
    assert.deepEqual(parsePaste("> said")[0], { fields: { type: "quote" }, text: "said" });
  });

  it("converts each line on its own", () => {
    assert.deepEqual(types("# Title\n- one\nplain"), ["heading", "list", "text"]);
  });

  it("leaves a marker mid-line alone — only the start of a line is a marker", () => {
    assert.deepEqual(parsePaste("see # 3")[0], { fields: { type: "text" }, text: "see # 3" });
  });

  it("needs the space: `#Title` is not a heading", () => {
    assert.equal(parsePaste("#Title")[0]!.fields.type, "text");
  });

  it("leaves a bare marker as an empty block of that type", () => {
    assert.deepEqual(parsePaste("- ")[0], {
      fields: { type: "list", style: "unordered", depth: 0 },
      text: "",
    });
  });

  it("reads a deeper heading as the smallest one — the SRS has three levels", () => {
    assert.deepEqual(parsePaste("#### Deep")[0], { fields: { type: "heading", level: 3 }, text: "Deep" });
  });

  it("leaves inline Markdown in the text, where it is drawn rather than stored", () => {
    assert.deepEqual(parsePaste("- **채용 신분:** 정규직")[0]!.text, "**채용 신분:** 정규직");
  });
});

describe("parsePaste — Markdown structure", () => {
  const fields = (text: string) => parsePaste(text).map((line) => line.fields);

  it("nests list items by their indentation", () => {
    assert.deepEqual(
      fields("- a\n    - b\n        1. c\n  - d\n- e").map((f) => (f.type === "list" ? f.depth : -1)),
      [0, 1, 2, 1, 0],
    );
    assert.deepEqual(parsePaste("    - 경력 일부 인정")[0], {
      fields: { type: "list", style: "unordered", depth: 0 },
      text: "경력 일부 인정",
    });
  });

  it("reads GFM checklists", () => {
    assert.deepEqual(parsePaste("- [ ] todo\n* [X] done"), [
      { fields: { type: "checklist", checked: false }, text: "todo" },
      { fields: { type: "checklist", checked: true }, text: "done" },
    ]);
  });

  it("reads a thematic break as a divider, before it could be a list", () => {
    assert.deepEqual(types("---\n* * *\n___\n- - -"), ["divider", "divider", "divider", "divider"]);
  });

  it("keeps a fenced code block as one block, blank lines and markers included", () => {
    assert.deepEqual(parsePaste("```js\nconst a = 1;\n\n# not a heading\n```\nafter"), [
      { fields: { type: "code" }, text: "const a = 1;\n\n# not a heading" },
      { fields: { type: "text" }, text: "after" },
    ]);
  });

  it("runs an unclosed fence to the end, as CommonMark does", () => {
    assert.deepEqual(parsePaste("~~~\na\nb"), [{ fields: { type: "code" }, text: "a\nb" }]);
  });

  it("reads a GFM table, header first, padding short rows", () => {
    assert.deepEqual(parsePaste("| 이름 | 값 |\n|---|:---:|\n| a\\|b | x<br>y |\n| only |\nafter")[0], {
      fields: { type: "table", cells: [["이름", "값"], ["a|b", "x\ny"], ["only", ""]] },
      text: "",
    });
    assert.deepEqual(types("| a | b |\n|---|---|\n| 1 | 2 |\nafter"), ["table", "text"]);
  });

  it("does not take prose with a pipe over a divider for a table", () => {
    assert.deepEqual(types("a | b\n---"), ["text", "divider"]);
  });
});
