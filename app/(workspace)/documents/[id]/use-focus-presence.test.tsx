// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, fireEvent, renderHook } from "@testing-library/react";

import { useFocusPresence } from "./use-focus-presence.ts";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

/** The hook over a bare scroll container, following `followingId`. */
function follow(followingId: string | null) {
  const container = document.createElement("div");
  const textarea = document.createElement("textarea");
  container.append(textarea);
  document.body.append(container);
  const pauseFollow = vi.fn();
  renderHook(() =>
    useFocusPresence({
      documentId: "d1",
      containerRef: { current: container },
      blocksLoaded: true,
      blocks: [],
      members: [],
      followingId,
      isPresenting: false,
      setPresenting: () => undefined,
      scrollTarget: null,
      clearScrollTarget: () => undefined,
      pauseFollow,
    }),
  );
  return { container, textarea, pauseFollow };
}

describe("useFocusPresence — the follower's own move (UC-030 E3-1)", () => {
  it("pauses on a wheel, a touch, a press or typing", () => {
    const { container, textarea, pauseFollow } = follow("bob");

    fireEvent.wheel(container);
    fireEvent.touchMove(container);
    fireEvent.pointerDown(textarea);
    fireEvent(textarea, new InputEvent("beforeinput", { bubbles: true }));

    assert.equal(pauseFollow.mock.calls.length, 4);
  });

  it("does not pause on a scroll alone — the follow's own scroll fires one too", () => {
    const { container, pauseFollow } = follow("bob");

    fireEvent.scroll(container);

    assert.equal(pauseFollow.mock.calls.length, 0);
  });

  it("listens only while a follow drives the view", () => {
    const { container, pauseFollow } = follow(null);

    fireEvent.wheel(container);

    assert.equal(pauseFollow.mock.calls.length, 0);
  });
});
