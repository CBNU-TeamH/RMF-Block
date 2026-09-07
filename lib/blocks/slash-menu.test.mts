import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SLASH_ITEMS,
  detectSlashQuery,
  moveHighlight,
  scrollTopForHighlight,
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
    // PDF is still a keyword on the one file item, which is what makes this a
    // case/space test rather than a test of which items exist.
    assert.deepEqual(slashMenuItems("  PDF ").map((i) => i.id), ["file"]);
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
    assert.ok(kinds.includes("upload-file"));
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

describe("scrollTopForHighlight", () => {
  // A 256px viewport (`max-h-64`) over rows of 40px.
  const view = (scrollTop: number) => ({ scrollTop, height: 256 });
  const row = (index: number) => ({ top: index * 40, height: 40 });

  it("leaves a row that is already visible alone", () => {
    assert.equal(scrollTopForHighlight(view(0), row(0)), null);
    assert.equal(scrollTopForHighlight(view(0), row(5)), null);
  });

  it("scrolls down just far enough to reveal the row below the fold", () => {
    // Row 6 spans 240–280; the viewport ends at 256, so it overshoots by 24.
    assert.equal(scrollTopForHighlight(view(0), row(6)), 24);
  });

  it("scrolls up to the row's own top when it is above the fold", () => {
    assert.equal(scrollTopForHighlight(view(200), row(2)), 80);
  });

  it("brings the last row fully into view", () => {
    // Ten rows of 40 = 400 tall; the last spans 360–400, so scrollTop 144.
    assert.equal(scrollTopForHighlight(view(0), row(9)), 144);
  });

  it("wrapping from the last row back to the first scrolls to the top", () => {
    assert.equal(scrollTopForHighlight(view(144), row(0)), 0);
  });

  it("does not move for a row taller than the viewport, once its top is shown", () => {
    // Nothing can make it fully visible; showing its top is the honest answer.
    assert.equal(scrollTopForHighlight(view(0), { top: 0, height: 400 }), null);
  });
});
