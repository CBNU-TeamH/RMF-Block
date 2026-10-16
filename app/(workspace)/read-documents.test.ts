import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT;${url}`);
  }),
}));
vi.mock("@/lib/auth/current-member", () => ({ currentMember: vi.fn() }));
vi.mock("@/lib/documents/documents", () => ({ readDocuments: vi.fn() }));

import { currentMember } from "@/lib/auth/current-member";
import { readDocuments } from "@/lib/documents/documents";
import { HOST_PRESENCE } from "@/lib/presence/types";
import { readDocumentsOnce } from "./read-documents.ts";

const CATALOGUE = [
  {
    id: "doc-1",
    name: "회의록",
    parentId: null,
    createdBy: "member-1",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
];

afterEach(() => {
  vi.clearAllMocks();
});

describe("readDocumentsOnce — the catalogue's own gate (#203)", () => {
  it("redirects to /join without reading anything when no one is signed in", async () => {
    vi.mocked(currentMember).mockResolvedValue(null);
    vi.mocked(readDocuments).mockReturnValue(CATALOGUE);

    await assert.rejects(readDocumentsOnce(), /NEXT_REDIRECT;\/join/);
    assert.equal(vi.mocked(readDocuments).mock.calls.length, 0);
  });

  it("returns the catalogue to a member", async () => {
    vi.mocked(currentMember).mockResolvedValue({ id: "member-1", nickname: "누군가", colorTag: "#ef4444" });
    vi.mocked(readDocuments).mockReturnValue(CATALOGUE);

    assert.deepEqual(await readDocumentsOnce(), CATALOGUE);
  });

  it("returns the catalogue to the host", async () => {
    vi.mocked(currentMember).mockResolvedValue(HOST_PRESENCE);
    vi.mocked(readDocuments).mockReturnValue(CATALOGUE);

    assert.deepEqual(await readDocumentsOnce(), CATALOGUE);
  });
});
