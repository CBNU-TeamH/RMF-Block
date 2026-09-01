import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { detectMarkdownShortcut } from "./markdown-shortcuts.ts";

describe("detectMarkdownShortcut — heading", () => {
  it("matches one hash as H1", () => {
    assert.deepEqual(detectMarkdownShortcut("# "), { type: "heading", level: 1 });
  });

  it("matches two hashes as H2", () => {
    assert.deepEqual(detectMarkdownShortcut("## "), { type: "heading", level: 2 });
  });

  it("matches three hashes as H3", () => {
    assert.deepEqual(detectMarkdownShortcut("### "), { type: "heading", level: 3 });
  });

  it("does not match four hashes — SRS caps headings at H3", () => {
    assert.equal(detectMarkdownShortcut("#### "), null);
  });

  it("does not match without the trailing space", () => {
    assert.equal(detectMarkdownShortcut("#"), null);
    assert.equal(detectMarkdownShortcut("##"), null);
  });

  it("does not match once anything follows the marker", () => {
    assert.equal(detectMarkdownShortcut("# hello"), null);
  });

  it("does not match the marker appearing mid-string", () => {
    assert.equal(detectMarkdownShortcut("he# "), null);
  });
});

describe("detectMarkdownShortcut — quote", () => {
  it("matches '> '", () => {
    assert.deepEqual(detectMarkdownShortcut("> "), { type: "quote" });
  });

  it("does not match without the trailing space", () => {
    assert.equal(detectMarkdownShortcut(">"), null);
  });

  it("does not match once anything follows the marker", () => {
    assert.equal(detectMarkdownShortcut("> hello"), null);
  });
});

describe("detectMarkdownShortcut — code", () => {
  it("matches a bare triple backtick, no trailing space needed", () => {
    assert.deepEqual(detectMarkdownShortcut("```"), { type: "code" });
  });

  it("does not match one or two backticks", () => {
    assert.equal(detectMarkdownShortcut("`"), null);
    assert.equal(detectMarkdownShortcut("``"), null);
  });

  it("does not match once anything follows the fence", () => {
    assert.equal(detectMarkdownShortcut("```js"), null);
  });
});

describe("detectMarkdownShortcut — checklist", () => {
  it("matches '[] '", () => {
    assert.deepEqual(detectMarkdownShortcut("[] "), { type: "checklist" });
  });

  it("matches '[ ] '", () => {
    assert.deepEqual(detectMarkdownShortcut("[ ] "), { type: "checklist" });
  });

  it("does not match without the trailing space", () => {
    assert.equal(detectMarkdownShortcut("[]"), null);
  });

  it("does not match a checked box — no shortcut types a check mark in", () => {
    assert.equal(detectMarkdownShortcut("[x] "), null);
  });
});

describe("detectMarkdownShortcut — list", () => {
  it("matches '- ' as unordered", () => {
    assert.deepEqual(detectMarkdownShortcut("- "), { type: "list", style: "unordered" });
  });

  it("matches '* ' as unordered", () => {
    assert.deepEqual(detectMarkdownShortcut("* "), { type: "list", style: "unordered" });
  });

  it("matches '1. ' as ordered", () => {
    assert.deepEqual(detectMarkdownShortcut("1. "), { type: "list", style: "ordered" });
  });

  it("matches any starting number as ordered — numbering is computed at render, not stored", () => {
    assert.deepEqual(detectMarkdownShortcut("7. "), { type: "list", style: "ordered" });
  });

  it("does not match without the trailing space", () => {
    assert.equal(detectMarkdownShortcut("-"), null);
    assert.equal(detectMarkdownShortcut("1."), null);
  });

  it("does not match once anything follows the marker", () => {
    assert.equal(detectMarkdownShortcut("- hello"), null);
    assert.equal(detectMarkdownShortcut("1. hello"), null);
  });
});

describe("detectMarkdownShortcut — no match", () => {
  it("does not match empty or unrelated text", () => {
    assert.equal(detectMarkdownShortcut(""), null);
    assert.equal(detectMarkdownShortcut("hello"), null);
  });
});
