// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

const push = vi.fn();
const presence = { members: [] as Array<unknown>, memberId: "me" };
const nav = vi.hoisted(() => ({ pathname: "/documents/d1" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push }),
}));
vi.mock("./presence-provider", () => ({ useWorkspacePresence: () => presence }));

import { FocusFollowProvider, SHARE_ENDED_MS, SHARE_STARTED_MS, useFocusFollow } from "./focus-follow-provider.tsx";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  nav.pathname = "/documents/d1";
});

const me = { id: "me", nickname: "나", colorTag: "#111" };
const bob = { id: "bob", nickname: "밥", colorTag: "#222", location: { documentId: "d2", blockId: "b" } };
const presenter = { ...bob, presenting: { documentId: "d1", blockId: "b", ratio: 0 } };

function Probe({ onState }: { onState: (state: ReturnType<typeof useFocusFollow>) => void }) {
  onState(useFocusFollow());
  return null;
}

/** The provider and a getter for its latest state; `rerender` picks up a changed
 *  roster or route, which the mocks above hold. */
function setup() {
  let state!: ReturnType<typeof useFocusFollow>;
  const tree = () => (
    <FocusFollowProvider>
      <Probe onState={(s) => {
          state = s;
        }} />
    </FocusFollowProvider>
  );
  const { rerender } = render(tree());
  return { state: () => state, rerender: () => rerender(tree()) };
}

describe("FocusFollowProvider — jumpTo while following", () => {
  it("pauses the follow and moves, without asking (UC-030 E3-1)", () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    presence.members = [me, presenter];
    const { state } = setup();

    act(() => state().follow("bob"));
    act(() => state().jumpTo("bob"));

    assert.equal(confirm.mock.calls.length, 0);
    assert.equal(state().followingId, null);
    assert.equal(state().pausedId, "bob");
    assert.equal(push.mock.calls[0]?.[0], "/documents/d2");
  });

  it("moves when not following, and leaves nothing paused", () => {
    presence.members = [me, bob];
    const { state } = setup();

    act(() => state().jumpTo("bob"));

    assert.equal(push.mock.calls[0]?.[0], "/documents/d2");
    assert.equal(state().pausedId, null);
  });
});

describe("FocusFollowProvider — goToBlock (UC-050 E3-3)", () => {
  it("opens the document at the block, marked to be highlighted", () => {
    presence.members = [me];
    const { state } = setup();

    act(() => state().goToBlock("d2", "b9"));

    assert.equal(push.mock.calls[0]?.[0], "/documents/d2");
    assert.deepEqual(state().scrollTarget, { documentId: "d2", blockId: "b9", highlight: true });
  });

  it("scrolls the open document without navigating", () => {
    presence.members = [me];
    const { state } = setup();

    act(() => state().goToBlock("d1", "b1"));

    assert.equal(push.mock.calls.length, 0);
    assert.equal(state().scrollTarget?.blockId, "b1");
  });

  it("pauses a follow rather than asking to end it", () => {
    presence.members = [me, presenter];
    const { state } = setup();

    act(() => state().follow("bob"));
    act(() => state().goToBlock("d2", "b9"));

    assert.equal(state().pausedId, "bob");
    assert.equal(push.mock.calls[0]?.[0], "/documents/d2");
  });
});

describe("FocusFollowProvider — pausing a follow (UC-030 E3-1)", () => {
  it("pauses and resumes", () => {
    presence.members = [me, presenter];
    const { state } = setup();

    act(() => state().follow("bob"));
    act(() => state().pause());
    assert.equal(state().followingId, null);
    assert.equal(state().pausedId, "bob");

    act(() => state().resume());
    assert.equal(state().followingId, "bob");
    assert.equal(state().pausedId, null);
  });

  it("ends from a pause", () => {
    presence.members = [me, presenter];
    const { state } = setup();

    act(() => state().follow("bob"));
    act(() => state().pause());
    act(() => state().unfollow());

    assert.equal(state().followingId, null);
    assert.equal(state().pausedId, null);
  });

  it("pauses when the follower opens another document themselves", () => {
    presence.members = [me, presenter];
    const { state, rerender } = setup();

    act(() => state().follow("bob"));
    nav.pathname = "/documents/d9";
    rerender();

    assert.equal(state().pausedId, "bob");
    assert.equal(push.mock.calls.length, 0);
  });

  it("pauses when the follower leaves for a page that is not a document", () => {
    presence.members = [me, presenter];
    const { state, rerender } = setup();

    act(() => state().follow("bob"));
    nav.pathname = "/files";
    rerender();

    assert.equal(state().pausedId, "bob");
    assert.equal(push.mock.calls.length, 0);
  });

  it("takes the follower along when the presenter opens another document", () => {
    presence.members = [me, presenter];
    const { state, rerender } = setup();

    act(() => state().follow("bob"));
    presence.members = [me, { ...presenter, presenting: { documentId: "d3", blockId: "c", ratio: 0 } }];
    rerender();
    // The roster moves again before the route has: still one trip, not paused.
    presence.members = [me, { ...presenter, presenting: { documentId: "d3", blockId: "c", ratio: 0.5 } }];
    rerender();

    assert.deepEqual(push.mock.calls, [["/documents/d3"]]);
    assert.equal(state().followingId, "bob");
  });

  it("brings a resumed follower back to the presenter's document", () => {
    presence.members = [me, presenter];
    const { state, rerender } = setup();

    act(() => state().follow("bob"));
    act(() => state().pause());
    nav.pathname = "/documents/d9";
    rerender();
    act(() => state().resume());

    assert.deepEqual(push.mock.calls, [["/documents/d1"]]);
  });
});

describe("FocusFollowProvider — the end of a share (UC-030 E3-3)", () => {
  it("says so when the presenter stops, and clears itself", () => {
    vi.useFakeTimers();
    presence.members = [me, presenter];
    const { state, rerender } = setup();

    act(() => state().follow("bob"));
    presence.members = [me, bob];
    rerender();
    assert.equal(state().followingId, null);
    assert.deepEqual(state().shareEnded, { nickname: "밥", colorTag: "#222" });

    act(() => vi.advanceTimersByTime(SHARE_ENDED_MS));
    assert.equal(state().shareEnded, null);
  });

  it("says so to a paused follower too, and names a presenter who has left the roster", () => {
    presence.members = [me, presenter];
    const { state, rerender } = setup();

    act(() => state().follow("bob"));
    act(() => state().pause());
    presence.members = [me];
    rerender();

    assert.equal(state().pausedId, null);
    assert.deepEqual(state().shareEnded, { nickname: "밥", colorTag: "#222" });
  });

  it("stays quiet for a follower who left with 종료", () => {
    presence.members = [me, presenter];
    const { state } = setup();

    act(() => state().follow("bob"));
    act(() => state().unfollow());

    assert.equal(state().shareEnded, null);
  });
});

describe("FocusFollowProvider — the start of a share (FR-030-03)", () => {
  it("announces a member who starts presenting, and clears itself", () => {
    vi.useFakeTimers();
    presence.members = [me, bob];
    const { state, rerender } = setup();

    presence.members = [me, presenter];
    rerender();
    assert.deepEqual(state().shareStarted, { id: "bob", nickname: "밥", colorTag: "#222" });

    act(() => vi.advanceTimersByTime(SHARE_STARTED_MS));
    assert.equal(state().shareStarted, null);
  });

  it("is quiet for a share already running when the roster arrives", () => {
    presence.members = [];
    const { state, rerender } = setup();

    presence.members = [me, presenter];
    rerender();

    assert.equal(state().shareStarted, null);
  });

  it("is quiet for a presenter coming back after a drop", () => {
    presence.members = [me, presenter];
    const { state, rerender } = setup();

    presence.members = [me];
    rerender();
    presence.members = [me, presenter];
    rerender();

    assert.equal(state().shareStarted, null);
  });

  it("is quiet for this member's own share", () => {
    presence.members = [me, bob];
    const { state, rerender } = setup();

    presence.members = [{ ...me, presenting: { documentId: "d1", blockId: "b", ratio: 0 } }, bob];
    rerender();

    assert.equal(state().shareStarted, null);
  });

  it("goes once the member follows, or once the share ends first", () => {
    presence.members = [me, bob];
    const { state, rerender } = setup();

    presence.members = [me, presenter];
    rerender();
    act(() => state().follow("bob"));
    assert.equal(state().shareStarted, null);
    act(() => state().unfollow());

    presence.members = [me, bob];
    rerender();
    presence.members = [me, presenter];
    rerender();
    assert.equal(state().shareStarted?.id, "bob");
    presence.members = [me, bob];
    rerender();
    assert.equal(state().shareStarted, null);
  });
});

describe("FocusFollowProvider — a copied block address (FR-060-03)", () => {
  it("lands on the block, highlighted, and drops the hash", () => {
    window.history.replaceState(null, "", "/documents/d1#block=b-9");
    presence.members = [me];
    const { state } = setup();

    assert.deepEqual(state().scrollTarget, { documentId: "d1", blockId: "b-9", highlight: true });
    assert.equal(window.location.hash, "");
  });
});
