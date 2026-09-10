import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";

vi.mock("@/lib/auth/session-registry", () => ({
  sessionRegistry: { members: vi.fn() },
}));
vi.mock("@/lib/documents/documents", () => ({ readDocuments: vi.fn() }));

import { sessionRegistry } from "@/lib/auth/session-registry";
import { readDocuments } from "@/lib/documents/documents";
import WorkspaceHome from "./page.tsx";

afterEach(() => {
  vi.clearAllMocks();
});

describe("WorkspaceHome — creator join", () => {
  it("resolves a document's creator, or null when no member matches createdBy", async () => {
    const member = { id: "member-1", nickname: "누군가", colorTag: "#ef4444" };
    vi.mocked(sessionRegistry.members).mockReturnValue([member]);
    vi.mocked(readDocuments).mockReturnValue([
      {
        id: "doc-1",
        name: "찾아지는 문서",
        parentId: null,
        createdBy: "member-1",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "doc-2",
        // No member with this id — e.g. one removed after creating it.
        name: "만든 사람이 사라진 문서",
        parentId: null,
        createdBy: "ghost-member",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ]);

    const result = await WorkspaceHome();

    assert.equal(result.props.documents[0].creator, member);
    assert.equal(result.props.documents[1].creator, null);
  });
});
