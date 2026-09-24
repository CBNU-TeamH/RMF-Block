import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { BAR_HEIGHT, MIN_HEIGHT, MIN_WIDTH } from "../chat/window-frame.ts";
import {
  HEADER,
  MIN_CONTENT_WIDTH,
  MIN_FIT_WIDTH,
  applyFloatingGesture,
  closeView,
  fitFloating,
  fitView,
  moveView,
  openView,
  parseViews,
} from "./views.ts";

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

  it("keeps cascading after windows were fitted to their content", () => {
    let views = openView([], a, viewport);
    views = fitView(views, a, { width: 100, height: 30 }, viewport);
    views = openView(views, b, viewport);
    views = fitView(views, b, { width: 150, height: 30 }, viewport);
    assert.notEqual(views[0].frame.y, views[1].frame.y);
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

describe("fitView", () => {
  it("sizes the window to the content at scale 1, keeping its right edge", () => {
    const [opened] = openView([], a, viewport);
    const [fitted] = fitView([opened], a, { width: 180, height: 40 }, viewport);

    assert.deepEqual(fitted.base, { width: 180, height: 40 });
    assert.equal(fitted.frame.width, 180);
    assert.equal(fitted.frame.height, HEADER + 40);
    assert.equal(fitted.frame.x + fitted.frame.width, opened.frame.x + opened.frame.width);
  });

  it("never fits a window narrower than its title needs", () => {
    const [opened] = openView([], a, viewport);
    const [fitted] = fitView([opened], a, { width: 60, height: 30 }, viewport);
    assert.equal(fitted.frame.width, MIN_FIT_WIDTH);
    assert.equal(fitted.frame.height, HEADER + 30);
  });

  it("shrinks content taller than the viewport, ratio kept", () => {
    const [opened] = openView([], a, viewport);
    const [fitted] = fitView([opened], a, { width: 400, height: 2000 }, viewport);
    const content = fitted.frame.height - HEADER;

    assert.ok(fitted.frame.y + fitted.frame.height <= viewport.height - BAR_HEIGHT + 0.001);
    assert.ok(Math.abs(content / fitted.frame.width - 5) < 1e-9, `ratio ${content / fitted.frame.width}`);
  });
});

describe("applyFloatingGesture", () => {
  const base = { width: 200, height: 100 };
  const start = { x: 100, y: 100, width: 200, height: HEADER + 100 };

  it("scales from the corner with the content's ratio kept", () => {
    const next = applyFloatingGesture("corner", start, 100, 0, viewport, base);
    assert.equal(next.width, 300);
    assert.equal(next.height, HEADER + 150);
    assert.equal(next.x, start.x);
  });

  it("follows whichever axis moved further, in proportion", () => {
    assert.equal(applyFloatingGesture("corner", start, 10, 100, viewport, base).width, 400);
  });

  it("shrinks on a sideways drag inward, height following", () => {
    const next = applyFloatingGesture("corner", start, -50, 0, viewport, base);
    assert.equal(next.width, 150);
    assert.equal(next.height, HEADER + 75);
  });

  it("never grows a window smaller than the floor just because it was touched", () => {
    const tiny = { x: 100, y: 100, width: 60, height: HEADER + 20 };
    assert.equal(applyFloatingGesture("corner", tiny, 0, 0, viewport, { width: 60, height: 20 }).width, 60);
  });

  it("lets the viewport beat the floor", () => {
    const edge = { x: viewport.width - 100, y: 100, width: 100, height: HEADER + 50 };
    const next = applyFloatingGesture("corner", edge, 500, 0, viewport, { width: 100, height: 50 });
    assert.ok(next.x + next.width <= viewport.width + 0.001, `${next.x + next.width}`);
  });

  it("stops at the minimum width and at the viewport", () => {
    assert.equal(applyFloatingGesture("corner", start, -500, -500, viewport, base).width, MIN_CONTENT_WIDTH);

    const big = applyFloatingGesture("corner", start, 5000, 5000, viewport, base);
    assert.ok(big.x + big.width <= viewport.width + 0.001);
    assert.ok(big.y + big.height <= viewport.height - BAR_HEIGHT + 0.001);
  });

  it("moves without resizing, even below the chat window's minimum", () => {
    const small = { x: 100, y: 100, width: 150, height: HEADER + 20 };
    const moved = applyFloatingGesture("move", small, 30, 40, viewport, base);
    assert.deepEqual(moved, { x: 130, y: 140, width: 150, height: HEADER + 20 });
  });
});

describe("fitFloating", () => {
  it("scales a window down, ratio kept, when the viewport shrinks", () => {
    const base = { width: 200, height: 100 };
    const frame = { x: 600, y: 300, width: 800, height: HEADER + 400 };
    const next = fitFloating(frame, base, { width: 500, height: 400 });

    assert.ok(next.x >= 0 && next.x + next.width <= 500 + 0.001);
    assert.ok(next.y >= 0 && next.y + next.height <= 400 - BAR_HEIGHT + 0.001);
    assert.ok(Math.abs((next.height - HEADER) / next.width - 0.5) < 1e-9);
  });
});

describe("parseViews base", () => {
  it("keeps a valid base and drops a broken one", () => {
    const raw = JSON.stringify([
      { ...a, frame, base: { width: 180, height: 40 } },
      { ...b, frame, base: { width: -1, height: 40 } },
    ]);
    const [first, second] = parseViews(raw);
    assert.deepEqual(first.base, { width: 180, height: 40 });
    assert.equal(second.base, undefined);
  });
});
