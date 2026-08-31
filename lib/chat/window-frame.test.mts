import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MIN_HEIGHT,
  MIN_WIDTH,
  applyGesture,
  clamp,
  defaultFrame,
  parseFrame,
  type Frame,
  type Viewport,
} from "./window-frame.ts";

const laptop: Viewport = { width: 1440, height: 900 };

const area = (frame: Frame) => frame.width * frame.height;
const inside = (frame: Frame, viewport: Viewport) =>
  frame.x >= 0 &&
  frame.y >= 0 &&
  frame.x + frame.width <= viewport.width &&
  frame.y + frame.height <= viewport.height;

describe("defaultFrame", () => {
  it("takes about a ninth of the viewport", () => {
    const frame = defaultFrame(laptop);
    const ratio = area(frame) / (laptop.width * laptop.height);

    assert.ok(Math.abs(ratio - 1 / 9) < 0.01, `ratio was ${ratio}`);
  });

  it("opens against the bottom right", () => {
    const frame = defaultFrame(laptop);

    assert.ok(frame.x + frame.width > laptop.width * 0.9, "hugs the right edge");
    assert.ok(frame.y + frame.height > laptop.height * 0.8, "sits low");
  });

  it("stays on screen at every viewport worth trying", () => {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 3840, height: 2160 },
      { width: 1024, height: 768 },
      { width: 800, height: 600 },
    ]) {
      assert.ok(inside(defaultFrame(viewport), viewport), JSON.stringify(viewport));
    }
  });

  it("keeps a usable size on a viewport too small for a ninth of it", () => {
    const frame = defaultFrame({ width: 400, height: 300 });

    assert.equal(frame.width, MIN_WIDTH);
    assert.equal(frame.height, MIN_HEIGHT);
  });
});

describe("clamp", () => {
  it("pulls a window dragged off the right edge back", () => {
    const frame = clamp({ x: 5000, y: 100, width: 400, height: 300 }, laptop);

    assert.ok(inside(frame, laptop));
    assert.equal(frame.width, 400, "position moved, size did not");
  });

  it("pulls a window dragged above the top back", () => {
    // The case that matters most: a title bar dragged off the top cannot be
    // grabbed again, so the window would be lost until storage is cleared.
    const frame = clamp({ x: 100, y: -400, width: 400, height: 300 }, laptop);

    assert.ok(frame.y >= 0);
    assert.ok(inside(frame, laptop));
  });

  it("refuses to shrink below a usable size", () => {
    const frame = clamp({ x: 100, y: 100, width: 10, height: 10 }, laptop);

    assert.equal(frame.width, MIN_WIDTH);
    assert.equal(frame.height, MIN_HEIGHT);
  });

  it("refuses to grow past the viewport", () => {
    const frame = clamp({ x: 0, y: 0, width: 9999, height: 9999 }, laptop);

    assert.ok(inside(frame, laptop));
  });

  it("leaves a frame that already fits alone", () => {
    const frame: Frame = { x: 100, y: 100, width: 400, height: 300 };

    assert.deepEqual(clamp(frame, laptop), frame);
  });

  it("does not collapse on a viewport smaller than the minimum", () => {
    // A phone in landscape, or a window someone squashed. The size floor wins
    // and the window overflows — better than a 40px-tall sliver.
    const tiny = { width: 200, height: 150 };
    const frame = clamp({ x: 0, y: 0, width: 300, height: 300 }, tiny);

    assert.equal(frame.width, MIN_WIDTH);
    assert.equal(frame.height, MIN_HEIGHT);
    assert.ok(Number.isFinite(frame.x) && Number.isFinite(frame.y));
  });
});

describe("applyGesture", () => {
  const start: Frame = { x: 400, y: 300, width: 400, height: 300 };

  it("moves without resizing", () => {
    const moved = applyGesture("move", start, 50, -80, laptop);

    assert.deepEqual(moved, { x: 450, y: 220, width: 400, height: 300 });
  });

  it("resizes without moving", () => {
    const resized = applyGesture("resize", start, 120, 60, laptop);

    assert.deepEqual(resized, { x: 400, y: 300, width: 520, height: 360 });
  });

  it("measures from where the gesture began, not from the last frame", () => {
    // The pointer delta is cumulative, so applying it twice to the same start
    // must land in the same place — this is what keeps a drag from drifting.
    const once = applyGesture("move", start, 30, 30, laptop);

    assert.deepEqual(applyGesture("move", start, 30, 30, laptop), once);
  });

  it("stops at the edge rather than following the pointer off it", () => {
    const moved = applyGesture("move", start, 9999, 9999, laptop);

    assert.ok(inside(moved, laptop));
  });
});

describe("parseFrame", () => {
  it("reads back what was written", () => {
    const frame: Frame = { x: 1, y: 2, width: 300, height: 400 };

    assert.deepEqual(parseFrame(JSON.stringify(frame)), frame);
  });

  it("returns null for nothing stored", () => {
    assert.equal(parseFrame(null), null);
  });

  it("returns null for anything that is not a frame", () => {
    // Storage holds whatever was last written to that key — another version of
    // this app, a person with devtools, a half-finished write.
    for (const raw of [
      "not json",
      "null",
      "[]",
      '"a string"',
      "{}",
      '{"x":1,"y":2,"width":300}',
      '{"x":"1","y":2,"width":300,"height":400}',
      '{"x":null,"y":2,"width":300,"height":400}',
    ]) {
      assert.equal(parseFrame(raw), null, raw);
    }
  });

  it("returns null rather than letting NaN reach a style", () => {
    assert.equal(parseFrame('{"x":null,"y":0,"width":300,"height":400}'), null);
    assert.equal(parseFrame(`{"x":1e999,"y":0,"width":300,"height":400}`), null);
  });
});
