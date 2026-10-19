import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";

vi.mock("@/lib/auth/current-member", () => ({ currentMember: vi.fn() }));
vi.mock("@/lib/chat/chat-service", () => ({
  chatService: { list: vi.fn(), send: vi.fn() },
}));
vi.mock("@/lib/documents/documents", () => ({
  readDocuments: () => [{ id: "doc-1", name: "회의록" }],
}));

import { currentMember } from "@/lib/auth/current-member";
import { chatService } from "@/lib/chat/chat-service";
import { ChatValidationError } from "@/lib/chat/types";
import { GET, POST } from "./route.ts";

afterEach(() => {
  vi.clearAllMocks();
});

describe("/api/chat — auth gate", () => {
  it("GET returns 401 without a member", async () => {
    vi.mocked(currentMember).mockResolvedValue(null);

    const response = await GET();

    assert.equal(response.status, 401);
  });

  it("POST returns 401 without a member, before reading the body", async () => {
    vi.mocked(currentMember).mockResolvedValue(null);
    const request = new Request("http://x", { method: "POST" });
    const jsonSpy = vi.spyOn(request, "json");

    const response = await POST(request as never);

    assert.equal(response.status, 401);
    assert.equal(jsonSpy.mock.calls.length, 0);
  });
});

describe("/api/chat — malformed body (currently caught downstream, not by the route itself)", () => {
  it("POST maps ChatValidationError (empty text, no attachment) to 400", async () => {
    vi.mocked(currentMember).mockResolvedValue({
      id: "member-1",
      nickname: "누군가",
      colorTag: "#ef4444",
    });
    const message = "메시지나 첨부 파일 중 하나는 있어야 합니다.";
    vi.mocked(chatService.send).mockRejectedValue(new ChatValidationError(message));

    const response = await POST(
      new Request("http://x", { method: "POST", body: JSON.stringify({}) }) as never,
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: message });
  });
});

describe("/api/chat — a link (FR-060-03)", () => {
  const member = { id: "member-1", nickname: "누군가", colorTag: "#ef4444" };
  const post = (body: unknown) =>
    POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }) as never);

  it("names the document from the catalogue, not the request, and caps the excerpt", async () => {
    vi.mocked(currentMember).mockResolvedValue(member);
    vi.mocked(chatService.send).mockResolvedValue({} as never);

    const response = await post({
      link: { documentId: "doc-1", blockId: "b-1", documentName: "가짜 이름", excerpt: ` ${"가".repeat(200)} ` },
    });

    assert.equal(response.status, 201);
    const { link } = vi.mocked(chatService.send).mock.calls[0][0];
    assert.deepEqual({ ...link, excerpt: link?.excerpt?.length }, {
      documentId: "doc-1",
      blockId: "b-1",
      documentName: "회의록",
      excerpt: 80,
    });
  });

  it("links a whole document when no block is named", async () => {
    vi.mocked(currentMember).mockResolvedValue(member);
    vi.mocked(chatService.send).mockResolvedValue({} as never);

    await post({ link: { documentId: "doc-1" } });

    assert.deepEqual(vi.mocked(chatService.send).mock.calls[0][0].link, { documentId: "doc-1", documentName: "회의록" });
  });

  it("refuses a document the catalogue does not have, and a malformed block id", async () => {
    vi.mocked(currentMember).mockResolvedValue(member);

    assert.equal((await post({ link: { documentId: "gone" } })).status, 400);
    assert.equal((await post({ link: { documentId: "doc-1", blockId: "x".repeat(65) } })).status, 400);
    assert.equal((await post({ link: { documentId: "doc-1", blockId: 7 } })).status, 400);
    assert.equal(vi.mocked(chatService.send).mock.calls.length, 0);
  });
});
