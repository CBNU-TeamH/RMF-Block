// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

const push = vi.fn();
const presence = { members: [] as Array<unknown>, memberId: "me" };

vi.mock("next/navigation", () => ({
  usePathname: () => "/documents/d1",
  useRouter: () => ({ push }),
}));
vi.mock("./presence-provider", () => ({ useWorkspacePresence: () => presence }));

import { FocusFollowProvider, useFocusFollow } from "./focus-follow-provider.tsx";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const bob = { id: "bob", nickname: "밥", colorTag: "#222", location: { documentId: "d2", blockId: "b" } };
const presenter = { ...bob, presenting: { documentId: "d1", blockId: "b", ratio: 0 } };

function Probe({ onState }: { onState: (state: ReturnType<typeof useFocusFollow>) => void }) {
  onState(useFocusFollow());
  return null;
}

describe("FocusFollowProvider — jumpTo while following", () => {
  const setup = () => {
    let state!: ReturnType<typeof useFocusFollow>;
    render(
      <FocusFollowProvider>
        <Probe onState={(s) => {
            state = s;
          }} />
      </FocusFollowProvider>,
    );
    return () => state;
  };

  it("stays put and keeps following when the person declines", () => {
    vi.stubGlobal("confirm", () => false);
    presence.members = [{ id: "me", nickname: "나", colorTag: "#111" }, presenter];
    const state = setup();

    act(() => state().follow("bob"));
    act(() => state().jumpTo("bob"));

    assert.equal(push.mock.calls.length, 0);
    assert.equal(state().returnTo, null);
  });

  it("ends the follow and moves when the person accepts", () => {
    vi.stubGlobal("confirm", () => true);
    presence.members = [{ id: "me", nickname: "나", colorTag: "#111" }, presenter];
    const state = setup();

    act(() => state().follow("bob"));
    act(() => state().jumpTo("bob"));

    assert.equal(state().followingId, null);
    assert.equal(push.mock.calls[0]?.[0], "/documents/d2");
  });

  it("moves without asking when not following", () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    presence.members = [{ id: "me", nickname: "나", colorTag: "#111" }, bob];
    const state = setup();

    act(() => state().jumpTo("bob"));

    assert.equal(confirm.mock.calls.length, 0);
    assert.equal(push.mock.calls[0]?.[0], "/documents/d2");
  });
});
