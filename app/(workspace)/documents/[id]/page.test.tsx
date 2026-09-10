import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/lib/documents/documents", () => ({ readDocuments: vi.fn() }));

import { readDocuments } from "@/lib/documents/documents";
import DocumentPage from "./page.tsx";

afterEach(() => {
  vi.clearAllMocks();
});

describe("DocumentPage — unknown id", () => {
  it("calls notFound for an unknown document id", async () => {
    vi.mocked(readDocuments).mockReturnValue([
      {
        id: "doc-1",
        name: "회의록",
        parentId: null,
        createdBy: "member-1",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ]);

    await assert.rejects(
      DocumentPage({ params: Promise.resolve({ id: "missing" }) }),
      /NEXT_NOT_FOUND/,
    );
  });
});
