// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/documents/wk1",
}));

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
