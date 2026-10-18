// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const openFloating = vi.fn();
const goToBlock = vi.fn();
const openChatAt = vi.fn();
vi.mock("../floating-views.tsx", () => ({ useFloatingViews: () => openFloating }));
vi.mock("../focus-follow-provider.tsx", () => ({ useFocusFollow: () => ({ goToBlock }) }));
vi.mock("../chat-window.tsx", () => ({ useOpenChatAt: () => openChatAt }));

import type { WorkspaceFile } from "@/lib/files/workspace-files";
import { FileManager } from "./file-manager.tsx";

const FILES: Array<WorkspaceFile> = [
  {
    fileId: "f1",
    name: "diagram.png",
    type: "image/png",
    size: 340_000,
    uploadedBy: "민수",
    uploadedAt: "2026-10-16T00:00:00.000Z",
    kind: "image",
    source: { kind: "document", documentId: "doc-a", documentName: "회의록", blockId: "b1" },
  },
  {
    fileId: "c1",
    name: "photo.jpg",
    type: "image/jpeg",
    size: 1_200_000,
    uploadedBy: "지은",
    uploadedAt: "2026-10-15T00:00:00.000Z",
    kind: "image",
    source: { kind: "chat", messageId: "m1" },
  },
  {
    fileId: "f2",
    name: "spec.pdf",
    type: "application/pdf",
    size: 800_000,
    uploadedBy: "민수",
    uploadedAt: "2026-10-14T00:00:00.000Z",
    kind: "pdf",
    source: { kind: "document", documentId: "doc-b", documentName: "API 명세", blockId: "b2" },
  },
  {
    fileId: "c2",
    name: "budget.xlsx",
    type: "application/vnd.ms-excel",
    size: 45_000,
    uploadedBy: "지은",
    uploadedAt: "2026-10-13T00:00:00.000Z",
    kind: "document",
    source: { kind: "chat", messageId: "m2" },
  },
];

const serve = (body: object) => vi.stubGlobal("fetch", vi.fn(async () => Response.json(body)));
const rowOf = (name: string) => screen.getByText(name).closest("tr") as HTMLElement;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("FileManager — the list", () => {
  it("groups by type with counts, and shows each file's source", async () => {
    serve({ files: FILES, documentsUnavailable: false });
    render(<FileManager />);

    await screen.findByText("diagram.png");
    assert.equal(screen.getByRole("button", { name: "이미지 2" }).getAttribute("aria-pressed"), "true");
    assert.ok(screen.getByRole("button", { name: "PDF 1" }));
    assert.ok(screen.getByRole("button", { name: "기타 1" }));
    assert.ok(within(rowOf("diagram.png")).getByText("회의록"));
    assert.ok(within(rowOf("photo.jpg")).getByText("채팅"));
    assert.equal(screen.queryByText("spec.pdf"), null);
  });

  it("goes to the block for a document file, and to the message for a chat file", async () => {
    serve({ files: FILES, documentsUnavailable: false });
    render(<FileManager />);

    fireEvent.click(await screen.findByRole("button", { name: "diagram.png 원본 위치" }));
    fireEvent.click(screen.getByRole("button", { name: "photo.jpg 원본 위치" }));

    assert.deepEqual(goToBlock.mock.calls, [["doc-a", "b1"]]);
    assert.deepEqual(openChatAt.mock.calls, [["m1"]]);
  });

  it("previews only what opens inline; anything else is a download", async () => {
    serve({ files: FILES, documentsUnavailable: false });
    render(<FileManager />);

    fireEvent.click(await screen.findByRole("button", { name: "diagram.png 미리보기" }));
    assert.deepEqual(openFloating.mock.calls[0], [
      { fileId: "f1", fileName: "diagram.png", fileType: "image/png", size: 340_000 },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "기타 1" }));
    assert.equal(screen.queryByRole("button", { name: "budget.xlsx 미리보기" }), null);
    assert.equal(
      screen.getByRole("link", { name: "budget.xlsx 내려받기" }).getAttribute("href"),
      "/api/files/c2/download",
    );
  });

  it("says so when the document side could not be read", async () => {
    serve({ files: FILES.filter((file) => file.source.kind === "chat"), documentsUnavailable: true });
    render(<FileManager />);

    assert.match((await screen.findByRole("status")).textContent ?? "", /채팅 파일만/);
  });
});

describe("FileManager — failure", () => {
  it("offers a retry when the list does not load", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValue(Response.json({ files: FILES, documentsUnavailable: false }));
    vi.stubGlobal("fetch", fetch);
    render(<FileManager />);

    fireEvent.click(within(await screen.findByRole("alert")).getByRole("button", { name: "다시 시도" }));

    await screen.findByText("diagram.png");
    assert.equal(fetch.mock.calls.length, 2);
  });
});
