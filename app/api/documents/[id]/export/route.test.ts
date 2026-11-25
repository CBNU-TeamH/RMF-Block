import assert from "node:assert/strict";
import { strFromU8, unzipSync } from "fflate";
import { NextRequest } from "next/server";
import { afterEach, describe, it, vi } from "vitest";

vi.mock("@/lib/auth/current-member", () => ({ currentMember: vi.fn() }));
vi.mock("@/lib/documents/documents", () => ({
  readDocuments: () => [
    { id: "doc-a", name: "회의록" },
    { id: "doc-b", name: "1차", parentId: "doc-a" },
  ],
}));
vi.mock("@/lib/files/file-repository", () => ({
  fileRepository: {
    list: vi.fn(async () => [{ id: "f1" }]),
    read: vi.fn(async () => Buffer.from([1, 2, 3])),
  },
}));
vi.mock("@/lib/yorkie-admin", () => ({ readDocumentRoots: vi.fn(), yorkieAdminAddr: () => "http://yorkie:8080" }));

import { currentMember } from "@/lib/auth/current-member";
import { fileRepository } from "@/lib/files/file-repository";
import { readDocumentRoots } from "@/lib/yorkie-admin";
import { GET } from "./route.ts";

const MEMBER = { id: "member-1", nickname: "민수", colorTag: "#ef4444" };
const root = (...blocks: Array<object>) => JSON.stringify({ blocks });
const textBlock = (id: string, value: string) => ({ id, type: "text", content: { text: [{ val: value }] } });

const get = (id: string, query = "") =>
  GET(new NextRequest(`http://0.0.0.0:3000/api/documents/${id}/export${query}`, { headers: { host: "192.168.0.2:3000" } }), {
    params: Promise.resolve({ id }),
  });

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/documents/[id]/export", () => {
  it("returns 401 without a member, before asking Yorkie", async () => {
    vi.mocked(currentMember).mockResolvedValue(null);

    assert.equal((await get("doc-a")).status, 401);
    assert.equal(vi.mocked(readDocumentRoots).mock.calls.length, 0);
  });

  it("returns 404 for a document not in the catalogue", async () => {
    vi.mocked(currentMember).mockResolvedValue(MEMBER);

    assert.equal((await get("gone")).status, 404);
  });

  it("returns 503 when Yorkie cannot be read", async () => {
    vi.mocked(currentMember).mockResolvedValue(MEMBER);
    vi.mocked(readDocumentRoots).mockRejectedValue(new Error("connect ECONNREFUSED"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    assert.equal((await get("doc-a")).status, 503);
  });

  it("sends a text-only document as one .md, reading only that document", async () => {
    vi.mocked(currentMember).mockResolvedValue(MEMBER);
    vi.mocked(readDocumentRoots).mockResolvedValue(new Map([["doc-a", root(textBlock("b1", "본문"), { id: "b2", type: "doc-link", content: { documentId: "doc-b" } })]]));

    const response = await get("doc-a", "?subpages=0");

    assert.deepEqual(vi.mocked(readDocumentRoots).mock.calls[0]?.[1], ["doc-a"]);
    assert.equal(response.headers.get("Content-Type"), "text/markdown; charset=utf-8");
    assert.equal(response.headers.get("Content-Disposition"), `attachment; filename*=UTF-8''${encodeURIComponent("회의록.md")}`);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    // A sub-page left out is linked at the address the browser used.
    assert.equal(await response.text(), "본문\n\nhttp://192.168.0.2:3000/documents/doc-b");
  });

  it("zips sub-pages and files, byte for byte", async () => {
    vi.mocked(currentMember).mockResolvedValue(MEMBER);
    vi.mocked(readDocumentRoots).mockResolvedValue(
      new Map([
        ["doc-a", root(textBlock("b1", "본문"))],
        ["doc-b", root({ id: "b2", type: "image", content: { fileId: "f1", fileName: "도표.png", size: 3 } })],
      ]),
    );

    const response = await get("doc-a", "?subpages=1");

    assert.equal(response.headers.get("Content-Type"), "application/zip");
    assert.equal(response.headers.get("Content-Disposition"), `attachment; filename*=UTF-8''${encodeURIComponent("회의록.zip")}`);
    const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
    assert.deepEqual(Object.keys(files), ["회의록.md", "회의록/1차.md", "회의록/1차/도표.png"]);
    assert.equal(strFromU8(files["회의록/1차.md"]!), "![도표.png](<1차/도표.png>)");
    assert.deepEqual([...files["회의록/1차/도표.png"]!], [1, 2, 3]);
  });

  it("fails rather than leave out a file the store could not read", async () => {
    vi.mocked(currentMember).mockResolvedValue(MEMBER);
    vi.mocked(readDocumentRoots).mockResolvedValue(
      new Map([["doc-a", root({ id: "b1", type: "image", content: { fileId: "f1", fileName: "a.png", size: 3 } })]]),
    );
    vi.mocked(fileRepository.read).mockRejectedValueOnce(Object.assign(new Error("permission denied"), { code: "EACCES" }));

    await assert.rejects(get("doc-a"), /permission denied/);
  });

  it("writes a file the store no longer lists as its name, without fetching it", async () => {
    vi.mocked(currentMember).mockResolvedValue(MEMBER);
    vi.mocked(readDocumentRoots).mockResolvedValue(
      new Map([["doc-a", root({ id: "b1", type: "file", content: { fileId: "trashed", fileName: "옛.docx", fileType: "x", size: 1 } })]]),
    );

    const response = await get("doc-a");

    assert.equal(await response.text(), "옛.docx");
    assert.equal(vi.mocked(fileRepository.read).mock.calls.length, 0);
  });
});
