// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const follow = vi.fn();
const presence = { members: [] as Array<unknown>, isPresenting: false, setPresenting: vi.fn() };

vi.mock("next/navigation", () => ({ usePathname: () => "/documents/doc-1" }));
vi.mock("./presence-provider", () => ({ useWorkspacePresence: () => presence }));
vi.mock("./focus-follow-provider", () => ({
  useFocusFollow: () => ({ followingId: null, follow, unfollow: vi.fn() }),
}));

import { FocusShare } from "./focus-share.tsx";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  presence.members = [];
});

const member = (id: string, nickname: string, presenting: boolean) => ({
  id,
  nickname,
  presenting: presenting ? { documentId: "doc-1", blockId: "b", ratio: 0 } : null,
});

describe("FocusShare", () => {
  it("offers 공유하기 when nobody else is presenting", () => {
    presence.members = [member("me", "나", false)];
    render(<FocusShare memberId="me" />);

    assert.ok(screen.getByRole("button", { name: "공유하기" }));
  });

  /** The roster arrives in whatever order Yorkie iterates it, and two browsers
   *  need not see the same order. `members.find(...)` therefore offered two
   *  followers two different presenters with no way to tell there was a choice.
   *  Sorting by id is what makes every client name the same person — so the
   *  same roster shuffled has to produce the same answer. */
  it("names the same presenter whichever order the roster arrives in", () => {
    const roster = [member("m-3", "다", true), member("m-1", "가", true), member("m-2", "나", true)];

    presence.members = roster;
    render(<FocusShare memberId="me" />);
    assert.ok(screen.getByRole("button", { name: "가님이 공유 중 · 참여하기" }));
    cleanup();

    presence.members = [...roster].reverse();
    render(<FocusShare memberId="me" />);
    assert.ok(screen.getByRole("button", { name: "가님이 공유 중 · 참여하기" }));
  });

  /** Two members can both be presenting for the moment presence takes to
   *  settle. Falling through to 공유하기 there would invite a third — the
   *  branch is `length > 0`, not `=== 1`, for exactly this. */
  it("does not offer 공유하기 while more than one other member is presenting", () => {
    presence.members = [member("m-1", "가", true), member("m-2", "나", true)];
    render(<FocusShare memberId="me" />);

    assert.equal(screen.queryByRole("button", { name: "공유하기" }), null);
  });

  /** One presenter at a time is the shipped constraint (issue #100), so the
   *  control that used to pick between several is gone rather than left
   *  unreachable. */
  it("has no presenter picker", () => {
    presence.members = [member("m-1", "가", true), member("m-2", "나", true)];
    render(<FocusShare memberId="me" />);

    assert.equal(screen.queryByRole("combobox"), null);
  });
});
