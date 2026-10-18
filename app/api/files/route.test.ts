import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";

vi.mock("@/lib/auth/current-member", () => ({ currentMember: vi.fn() }));
vi.mock("@/lib/documents/documents", () => ({ readDocuments: () => [{ id: "doc-a", name: "회의록" }] }));
vi.mock("@/lib/files/file-repository", () => ({
  fileRepository: {
    list: vi.fn(async () => [
      { id: "f1", name: "a.png", type: "image/png", size: 1, uploadedBy: "민수", uploadedAt: "2026-10-16T00:00:00Z", origin: "document" },
    ]),
  },
}));
vi.mock("@/lib/chat/chat-service", () => ({
  chatService: {
    list: async () => [
      { id: "m1", sender: "지은", text: "", sentAt: "2026-10-15T00:00:00Z", attachment: { fileId: "c1", fileName: "c.pdf", fileType: "application/pdf", size: 2 } },
    ],
  },
}));
vi.mock("@/lib/yorkie-admin", () => ({ readDocumentRoots: vi.fn(), yorkieAdminAddr: () => "http://yorkie:8080" }));

import { currentMember } from "@/lib/auth/current-member";
import { fileRepository } from "@/lib/files/file-repository";
import { readDocumentRoots } from "@/lib/yorkie-admin";
import { GET } from "./route.ts";

const MEMBER = { id: "member-1", nickname: "민수", colorTag: "#ef4444" };

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("GET /api/files", () => {
  it("returns 401 without a member, before asking Yorkie", async () => {
    vi.mocked(currentMember).mockResolvedValue(null);

    const response = await GET();

    assert.equal(response.status, 401);
    assert.equal(vi.mocked(readDocumentRoots).mock.calls.length, 0);
  });

  it("lists the document files Yorkie places and every chat file", async () => {
    vi.mocked(currentMember).mockResolvedValue(MEMBER);
    vi.mocked(readDocumentRoots).mockResolvedValue(
      new Map([["doc-a", JSON.stringify({ blocks: [{ id: "b1", type: "image", content: { fileId: "f1" } }] })]]),
    );

    const response = await GET();
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.documentsUnavailable, false);
    assert.deepEqual(body.files.map((file: { fileId: string }) => file.fileId), ["f1", "c1"]);
    assert.deepEqual(vi.mocked(readDocumentRoots).mock.calls[0]?.[1], ["doc-a"]);
    assert.deepEqual(vi.mocked(fileRepository.list).mock.calls[0], ["document"]);
  });

  it("still lists chat files, and says so, when Yorkie cannot be read", async () => {
    vi.mocked(currentMember).mockResolvedValue(MEMBER);
    vi.mocked(readDocumentRoots).mockRejectedValue(new Error("connect ECONNREFUSED"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const body = await (await GET()).json();

    assert.equal(body.documentsUnavailable, true);
    assert.deepEqual(body.files.map((file: { fileId: string }) => file.fileId), ["c1"]);
  });
});
