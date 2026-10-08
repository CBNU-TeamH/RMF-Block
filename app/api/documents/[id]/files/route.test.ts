import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";

vi.mock("@/lib/auth/current-member", () => ({ currentMember: vi.fn() }));
vi.mock("@/lib/documents/documents", () => ({ readDocuments: vi.fn(() => [{ id: "doc-1" }]) }));
vi.mock("@/lib/files/file-repository", () => ({
  fileRepository: { save: vi.fn(async (_bytes, file) => ({ ...file, id: "f-1" })) },
}));
vi.mock("@/lib/files/upload", async (original) => ({
  ...(await original<typeof import("@/lib/files/upload")>()),
  readUpload: vi.fn(),
}));

import { currentMember } from "@/lib/auth/current-member";
import { fileRepository } from "@/lib/files/file-repository";
import { readUpload } from "@/lib/files/upload";
import { POST } from "./route.ts";

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/documents/[id]/files — auth gate", () => {
  it("returns 401 without a member, before checking the document exists", async () => {
    vi.mocked(currentMember).mockResolvedValue(null);

    const response = await POST(new Request("http://x", { method: "POST" }) as never, {
      params: Promise.resolve({ id: "doc-1" }),
    });

    assert.equal(response.status, 401);
  });
});

describe("POST /api/documents/[id]/files — storing", () => {
  it("records which document the file belongs to, so it can follow it into the trash", async () => {
    vi.mocked(currentMember).mockResolvedValue({ nickname: "alice" } as never);
    vi.mocked(readUpload).mockResolvedValue({
      ok: true,
      file: new File([Buffer.from("%PDF-1.7")], "a.pdf"),
    } as never);

    const response = await POST(new Request("http://x", { method: "POST" }) as never, {
      params: Promise.resolve({ id: "doc-1" }),
    });

    assert.equal(response.status, 201);
    assert.equal(vi.mocked(fileRepository.save).mock.calls[0]![1].documentId, "doc-1");
  });
});
