// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const jumpTo = vi.fn();
const goBack = vi.fn();
const presence = { status: "active", members: [] as Array<unknown> };
const follow = { returnTo: null as unknown };

vi.mock("./presence-provider", () => ({ useWorkspacePresence: () => presence }));
vi.mock("./focus-follow-provider", () => ({
  useFocusFollow: () => ({ jumpTo, goBack, returnTo: follow.returnTo }),
}));

import { PresenceStack } from "./presence-stack.tsx";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  presence.members = [];
  follow.returnTo = null;
});

const me = { id: "me", nickname: "나", colorTag: "#111" };
const bob = { id: "bob", nickname: "밥", colorTag: "#222", location: { documentId: "d1", blockId: "b1" } };
const carol = { id: "carol", nickname: "캐롤", colorTag: "#333" };
const documents = [{ id: "d1", name: "기획서" }] as never;

describe("PresenceStack", () => {
  it("jumps to a connected member on click", () => {
    presence.members = [me, bob];
    render(<PresenceStack memberId="me" known={[me, bob, carol]} documents={documents} />);

    fireEvent.click(screen.getByRole("button"));
    assert.equal(jumpTo.mock.calls[0]?.[0], "bob");
  });

  it("shows a member who is not connected, dimmed and not clickable", () => {
    presence.members = [me];
    render(<PresenceStack memberId="me" known={[me, carol]} documents={documents} />);

    assert.equal(screen.queryAllByRole("button").length, 0);
    assert.ok(screen.getByText(/캐롤 · 오프라인/));
  });

  it("offers 돌아가기 only after a jump", () => {
    presence.members = [me, bob];
    const { rerender } = render(<PresenceStack memberId="me" known={[me, bob]} documents={documents} />);
    assert.equal(screen.queryByText("돌아가기"), null);

    follow.returnTo = { documentId: "d0", blockId: null };
    rerender(<PresenceStack memberId="me" known={[me, bob]} documents={documents} />);
    fireEvent.click(screen.getByText("돌아가기"));
    assert.equal(goBack.mock.calls.length, 1);
  });
});
