// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import { DocumentList, type DocumentRow } from "./document-list.tsx";

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

describe("DocumentList — dates", () => {
  it("renders a near-midnight UTC timestamp on its Seoul-local day", () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);

    // 15:30 UTC on Jan 1 is 00:30 KST on Jan 2 — the exact near-midnight case
    // the hydration mismatch was about (server: UTC, browser: KST).
    const documents: Array<DocumentRow> = [
      {
        id: "doc-1",
        name: "회의록",
        parentId: null,
        createdBy: "member-1",
        createdAt: "2026-01-01T15:30:00Z",
        updatedAt: "2026-01-01T15:30:00Z",
        creator: null,
      },
    ];

    render(<DocumentList documents={documents} />);

    const row = screen.getByText("회의록").closest("a");
    assert.ok(row, "expected the document row's link to be found");
    assert.equal(row.textContent?.includes("1. 1."), false);
    assert.equal(row.textContent?.includes("1. 2."), true);
  });
});
