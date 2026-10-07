// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/documents/wk1",
}));

const jumpTo = vi.fn();
const presence = { members: [] as Array<unknown>, memberId: "me" };
vi.mock("./presence-provider", () => ({ useWorkspacePresence: () => presence }));
vi.mock("./focus-follow-provider", () => ({ useFocusFollow: () => ({ jumpTo }) }));

import type { WorkspaceDocument } from "@/lib/documents/documents";
import { DocumentList } from "./document-list.tsx";

// happy-dom's real WebSocket would otherwise try to open an actual connection
// to a server that isn't there in a test — this component only needs the
// constructor and the two calls its effect makes not to throw.
class FakeWebSocket {
  addEventListener() {}
  close() {}
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  presence.members = [];
});

const doc = (id: string, name: string, parentId: string | null = null): WorkspaceDocument => ({
  id,
  name,
  parentId,
  createdBy: "member-1",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
});

describe("DocumentList — sidebar tree", () => {
  it("marks the open document as the current page, and only it", () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);

    render(<DocumentList documents={[doc("minutes", "회의록"), doc("wk1", "1주차 회의", "minutes")]} />);

    const links = screen.getAllByRole("link");
    assert.deepEqual(
      links.map((link) => [link.textContent, link.getAttribute("aria-current")]),
      [
        ["회의록", null],
        ["1주차 회의", "page"],
      ],
    );
  });

  it("indents a child one step past its parent", () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);

    render(<DocumentList documents={[doc("minutes", "회의록"), doc("wk1", "1주차 회의", "minutes")]} />);

    const [parent, child] = screen.getAllByRole("link");
    assert.equal(parent.style.paddingLeft, "4px");
    assert.equal(child.style.paddingLeft, "18px");
  });
});

describe("DocumentList — who is where (UC-040)", () => {
  const at = (documentId: string) => ({ documentId, blockId: null });

  beforeEach(() => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  it("dots a document with someone else in it, and a dot jumps to them", () => {
    presence.members = [
      { id: "me", nickname: "나", colorTag: "#111", location: at("a") },
      { id: "bob", nickname: "밥", colorTag: "#222", location: at("b") },
    ];
    render(<DocumentList documents={[doc("a", "가"), doc("b", "나")]} />);

    // Only the other member's document carries a dot; mine does not.
    assert.equal(screen.getAllByRole("button", { name: /에게 이동/ }).length, 1);
    fireEvent.click(screen.getByRole("button", { name: "밥에게 이동" }));
    assert.equal(jumpTo.mock.calls[0]?.[0], "bob");
  });

  it("shows no dot when nobody else is in any document", () => {
    presence.members = [{ id: "me", nickname: "나", colorTag: "#111", location: at("a") }];
    render(<DocumentList documents={[doc("a", "가")]} />);

    assert.equal(screen.queryAllByRole("button", { name: /에게 이동/ }).length, 0);
  });

  it("folds past three into a +N that opens a jump for each of them", () => {
    presence.members = [
      { id: "me", nickname: "나", colorTag: "#111" },
      ...["a", "b", "c", "d"].map((id) => ({ id, nickname: id, colorTag: "#222", location: at("x") })),
    ];
    render(<DocumentList documents={[doc("x", "문서")]} />);
    assert.equal(screen.getAllByRole("button", { name: /에게 이동/ }).length, 3);

    fireEvent.click(screen.getByRole("button", { name: "+1" }));
    assert.equal(screen.getAllByRole("button", { name: /에게 이동/ }).length, 4);
  });
});
