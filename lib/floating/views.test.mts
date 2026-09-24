import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { BAR_HEIGHT, MIN_HEIGHT, MIN_WIDTH } from "../chat/window-frame.ts";
import { closeView, moveView, openView, parseViews } from "./views.ts";

const viewport = { width: 1280, height: 800 };
const a = { documentId: "doc-1", blockId: "b-1" };
const b = { documentId: "doc-1", blockId: "b-2" };
const frame = { x: 10, y: 20, width: 300, height: 240 };

describe("openView", () => {
  it("adds a window inside the viewport and clear of the chat bar", () => {
    const [view] = openView([], a, viewport);

    assert.equal(view.blockId, "b-1");
    assert.ok(view.frame.width >= MIN_WIDTH && view.frame.height >= MIN_HEIGHT);
    assert.ok(view.frame.x >= 0 && view.frame.x + view.frame.width <= viewport.width);
    assert.ok(view.frame.y + view.frame.height <= viewport.height - BAR_HEIGHT);
  });

  it("does not open the same block twice", () => {
    const once = openView([], a, viewport);
    assert.equal(openView(once, a, viewport), once);
  });

  it("never lands a window on another after one has closed", () => {
    const c = { documentId: "doc-1", blockId: "b-3" };
    const three = openView(openView(openView([], a, viewport), b, viewport), c, viewport);
    const reopened = openView(closeView(three, b), b, viewport);
    const spots = reopened.map((view) => `${view.frame.x},${view.frame.y}`);
    assert.equal(new Set(spots).size, 3, spots.join(" "));
  });

  it("still opens a window when a tiny viewport has no free slot", () => {
    const tiny = { width: 300, height: 300 };
    let views = openView([], a, tiny);
    views = openView(views, b, tiny);
    assert.equal(openView(views, { documentId: "d", blockId: "c" }, tiny).length, 3);
  });

  it("steps each further window off the last one", () => {
    const [first, second] = openView(openView([], a, viewport), b, viewport);
    assert.notDeepEqual(first.frame, second.frame);
  });
});

describe("closeView / moveView", () => {
  it("touch only the named block", () => {
    const views = openView(openView([], a, viewport), b, viewport);

    assert.deepEqual(closeView(views, a), [views[1]]);

    const moved = moveView(views, b, frame);
    assert.deepEqual(moved[0], views[0]);
    assert.deepEqual(moved[1].frame, frame);
  });
});

describe("parseViews", () => {
  it("reads back what was written", () => {
    const views = [{ ...a, frame }];
    assert.deepEqual(parseViews(JSON.stringify(views)), views);
  });

  it("answers empty for nothing, junk and a non-list", () => {
    assert.deepEqual(parseViews(null), []);
    assert.deepEqual(parseViews("{not json"), []);
    assert.deepEqual(parseViews(JSON.stringify({ ...a, frame })), []);
  });

  it("drops malformed entries and duplicates, keeping the rest", () => {
    const raw = JSON.stringify([
      null,
      { ...a },
      { ...a, frame: { ...frame, x: "10" } },
      { documentId: 1, blockId: "b-1", frame },
      { ...b, frame },
      { ...b, frame: { ...frame, x: 99 } },
    ]);
    assert.deepEqual(parseViews(raw), [{ ...b, frame }]);
  });
});
