import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { NO_TABS, closeTab, landingId, moveTab, openTab, parseTabs, pruneTabs } from "./tabs.ts";

const tabs = { open: ["a", "b", "c"], active: "b" };

describe("parseTabs", () => {
  it("reads back what was stored", () => {
    assert.deepEqual(parseTabs(JSON.stringify(tabs)), tabs);
  });

  it("is empty for nothing, broken JSON or the wrong shape", () => {
    for (const raw of [null, "", "{", "[]", "null", '{"open":"a"}']) {
      assert.deepEqual(parseTabs(raw), NO_TABS, String(raw));
    }
  });

  it("drops non-string and duplicate ids, and an active that is not open", () => {
    assert.deepEqual(parseTabs('{"open":["a",1,"a","b"],"active":"z"}'), { open: ["a", "b"], active: null });
  });
});

describe("openTab", () => {
  it("appends a new document and makes it active", () => {
    assert.deepEqual(openTab(tabs, "d"), { open: ["a", "b", "c", "d"], active: "d" });
  });

  it("only activates one already open", () => {
    assert.deepEqual(openTab(tabs, "a"), { open: ["a", "b", "c"], active: "a" });
  });

  it("returns the same state when nothing changes", () => {
    assert.equal(openTab(tabs, "b"), tabs);
  });
});

describe("closeTab", () => {
  it("moves to the right neighbour of the active tab", () => {
    assert.deepEqual(closeTab(tabs, "b"), { tabs: { open: ["a", "c"], active: "c" }, next: "c" });
  });

  it("moves to the left neighbour when the active tab was last", () => {
    const last = { open: ["a", "b"], active: "b" };
    assert.deepEqual(closeTab(last, "b"), { tabs: { open: ["a"], active: "a" }, next: "a" });
  });

  it("stays put when an inactive tab closes", () => {
    assert.deepEqual(closeTab(tabs, "a"), { tabs: { open: ["b", "c"], active: "b" }, next: null });
  });

  it("leaves nothing to go to after the only tab", () => {
    assert.deepEqual(closeTab({ open: ["a"], active: "a" }, "a"), { tabs: NO_TABS, next: null });
  });

  it("ignores a tab that is not open", () => {
    assert.deepEqual(closeTab(tabs, "z"), { tabs, next: null });
  });
});

describe("pruneTabs", () => {
  it("drops what is gone, and the active with it", () => {
    assert.deepEqual(pruneTabs(tabs, (id) => id !== "b"), { open: ["a", "c"], active: null });
  });

  it("returns the same state when everything is kept", () => {
    assert.equal(pruneTabs(tabs, () => true), tabs);
  });
});

describe("moveTab", () => {
  it("puts a tab before another", () => {
    assert.deepEqual(moveTab(tabs, "c", "a").open, ["c", "a", "b"]);
    assert.deepEqual(moveTab(tabs, "a", "c").open, ["b", "a", "c"]);
  });

  it("puts a tab last", () => {
    assert.deepEqual(moveTab(tabs, "a", null).open, ["b", "c", "a"]);
  });

  it("keeps the order when dropped on itself or for an unknown id", () => {
    assert.equal(moveTab(tabs, "b", "b"), tabs);
    assert.equal(moveTab(tabs, "z", "a"), tabs);
  });
});

describe("landingId", () => {
  const documents = [{ id: "child", parentId: "root" }, { id: "root", parentId: null }, { id: "b" }];

  it("is the last document shown while it exists", () => {
    assert.equal(landingId({ open: ["b"], active: "b" }, documents), "b");
  });

  it("falls back to the first root document when that one is gone", () => {
    assert.equal(landingId({ open: ["gone"], active: "gone" }, documents), "root");
    assert.equal(landingId(NO_TABS, documents), "root");
  });

  it("is null in an empty workspace", () => {
    assert.equal(landingId(NO_TABS, []), null);
  });
});
