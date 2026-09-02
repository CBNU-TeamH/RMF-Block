import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SLASH_ITEMS,
  detectSlashQuery,
  moveHighlight,
  slashMenuItems,
} from "./slash-menu.ts";

describe("detectSlashQuery", () => {
  it("reads the query after a leading slash", () => {
    assert.equal(detectSlashQuery("/"), "");
    assert.equal(detectSlashQuery("/head"), "head");
    assert.equal(detectSlashQuery("/제목"), "제목");
  });

  it("ignores a slash that is not the first character", () => {
    // The cases this protects: a URL, a date, a fraction.
    for (const text of ["https://x", "2026/09/02", "1/2", "a /code"]) {
      assert.equal(detectSlashQuery(text), null, text);
    }
  });

  it("gives up once a space arrives", () => {
    // "/ 로 시작하는 문장" is prose, not a menu query.
    assert.equal(detectSlashQuery("/ "), null);
    assert.equal(detectSlashQuery("/code block"), null);
    assert.equal(detectSlashQuery("/a\nb"), null);
  });

  it("is not asking anything for ordinary text", () => {
    assert.equal(detectSlashQuery(""), null);
    assert.equal(detectSlashQuery("hello"), null);
  });
});

describe("slashMenuItems", () => {
  it("shows the whole menu for a bare slash", () => {
    assert.equal(slashMenuItems("").length, SLASH_ITEMS.length);
  });

  it("matches on the label", () => {
    assert.deepEqual(slashMenuItems("구분선").map((i) => i.id), ["divider"]);
  });

  it("matches on a keyword in either script", () => {
    // Someone reaching for a heading types whichever their keyboard is in.
    assert.ok(slashMenuItems("h1").some((i) => i.id === "heading-1"));
    assert.ok(slashMenuItems("제목").some((i) => i.id === "heading-1"));
    assert.ok(slashMenuItems("hr").some((i) => i.id === "divider"));
  });

  it("ignores case and surrounding space", () => {
    assert.deepEqual(slashMenuItems("  PDF ").map((i) => i.id), ["pdf"]);
  });

  it("returns nothing when nothing matches, so the menu can hide", () => {
    // The editor uses "no items" to mean "let Enter split the block again".
    assert.deepEqual(slashMenuItems("zzzz"), []);
  });

  it("keeps menu order rather than reordering by relevance", () => {
    const ids = slashMenuItems("목록").map((i) => i.id);
    assert.deepEqual(ids, ["list-unordered", "list-ordered"]);
  });
});

describe("SLASH_ITEMS", () => {
  it("has a unique id per item", () => {
    const ids = SLASH_ITEMS.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("offers the two types nothing else can create", () => {
    // Before this menu existed a divider had no way into a document at all,
    // and a PDF only arrived by drag-and-drop or the footer button.
    const kinds = SLASH_ITEMS.map((i) => i.action.kind);
    assert.ok(kinds.includes("divider"));
    assert.ok(kinds.includes("upload-pdf"));
  });
});

describe("moveHighlight", () => {
  it("wraps at both ends", () => {
    assert.equal(moveHighlight(0, -1, 3), 2);
    assert.equal(moveHighlight(2, 1, 3), 0);
    assert.equal(moveHighlight(0, 1, 3), 1);
  });

  it("does not divide by zero on an empty menu", () => {
    assert.equal(moveHighlight(0, 1, 0), 0);
  });
});
