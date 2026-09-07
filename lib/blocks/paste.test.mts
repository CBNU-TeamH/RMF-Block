import assert from "node:assert/strict";
import { describe, it } from "node:test";

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
      fields: { type: "list", style: "unordered" },
      text: "one",
    });
    assert.deepEqual(parsePaste("1. one")[0]!.fields, { type: "list", style: "ordered" });
    assert.deepEqual(parsePaste("* one")[0]!.fields, { type: "list", style: "unordered" });
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
      fields: { type: "list", style: "unordered" },
      text: "",
    });
  });

  it("does not treat four hashes as a heading — the SRS has three levels", () => {
    assert.equal(parsePaste("#### Deep")[0]!.fields.type, "text");
  });
});
