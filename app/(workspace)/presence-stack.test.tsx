// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const goBack = vi.fn();
const presence = { status: "active", members: [] as Array<unknown> };
const follow = { returnTo: null as unknown };

vi.mock("next/navigation", () => ({ usePathname: () => "/documents/d1" }));
vi.mock("./presence-provider", () => ({ useWorkspacePresence: () => presence }));
vi.mock("./focus-follow-provider", () => ({
  useFocusFollow: () => ({ goBack, returnTo: follow.returnTo }),
}));

import { PresenceStack } from "./presence-stack.tsx";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  presence.members = [];
  follow.returnTo = null;
});

const at = (documentId: string) => ({ documentId, blockId: null });
const me = { id: "me", nickname: "나", colorTag: "#111", location: at("d1") };
const bob = { id: "bob", nickname: "밥", colorTag: "#222", location: at("d1") };
const dan = { id: "dan", nickname: "댄", colorTag: "#444", location: at("d2") };
const carol = { id: "carol", nickname: "캐롤", colorTag: "#333" };

describe("PresenceStack", () => {
  it("shows only the members in the open document", () => {
    presence.members = [me, bob, dan];
    render(<PresenceStack memberId="me" known={[me, bob, dan]} />);

    assert.ok(screen.getAllByText("밥").length > 0);
    assert.equal(screen.queryAllByText("댄").length, 0);
  });

  it("puts a member who is not connected last, dimmed, and not clickable", () => {
    presence.members = [me, bob];
    render(<PresenceStack memberId="me" known={[me, bob, carol]} />);

    assert.equal(screen.queryAllByRole("button").length, 0);
    assert.ok(screen.getByText(/캐롤 · 오프라인/));
  });

  it("offers 돌아가기 only after a jump", () => {
    presence.members = [me, bob];
    const { rerender } = render(<PresenceStack memberId="me" known={[me, bob]} />);
    assert.equal(screen.queryByText("돌아가기"), null);

    follow.returnTo = { documentId: "d0", blockId: null };
    rerender(<PresenceStack memberId="me" known={[me, bob]} />);
    fireEvent.click(screen.getByText("돌아가기"));
    assert.equal(goBack.mock.calls.length, 1);
  });
});
