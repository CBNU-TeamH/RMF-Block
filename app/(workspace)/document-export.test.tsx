// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { WorkspaceDocument } from "@/lib/documents/documents";

const pathname = { current: "/documents/parent" };
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

import { DocumentExport } from "./document-export.tsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const doc = (id: string, name: string, parentId: string | null = null): WorkspaceDocument => ({
  id,
  name,
  parentId,
  createdBy: "m-1",
  createdAt: "2026-11-25T00:00:00.000Z",
  updatedAt: "2026-11-25T00:00:00.000Z",
});

const documents = [doc("parent", "회의록"), doc("child", "1차", "parent"), doc("grandchild", "메모", "child"), doc("alone", "혼자")];

const fileResponse = (name: string) =>
  new Response("본문", { headers: { "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}` } });

function setup(at: string, fetchMock = vi.fn().mockResolvedValue(fileResponse("회의록.zip"))) {
  pathname.current = at;
  vi.stubGlobal("fetch", fetchMock);
  // happy-dom has neither; the download only needs a URL to put on the link.
  Object.assign(URL, { createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
  const clicked: Array<string> = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push(this.download);
  });
  render(<DocumentExport documents={documents} />);
  return { fetchMock, clicked, user: userEvent.setup() };
}

const openMenu = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "문서 내보내기 메뉴" }));

describe("DocumentExport", () => {
  it("renders nothing away from a document", () => {
    setup("/files");

    assert.equal(screen.queryByRole("button", { name: "문서 내보내기 메뉴" }), null);
  });

  it("downloads a document without sub-pages at once, under the server's name", async () => {
    const { fetchMock, clicked, user } = setup("/documents/alone", vi.fn().mockResolvedValue(fileResponse("혼자.md")));

    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Markdown (.md)" }));

    await waitFor(() => assert.deepEqual(clicked, ["혼자.md"]));
    assert.equal(fetchMock.mock.calls[0]?.[0], "/api/documents/alone/export?subpages=0");
    assert.equal(screen.queryByRole("dialog"), null);
  });

  it("asks first when there are sub-pages, counting every level", async () => {
    const { fetchMock, clicked, user } = setup("/documents/parent");

    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Markdown (.md)" }));

    assert.ok(screen.getByText(/하위 문서 2개도 함께 내보낼까요/));
    assert.equal(fetchMock.mock.calls.length, 0);

    await user.click(screen.getByRole("button", { name: "하위 문서 포함" }));
    await waitFor(() => assert.deepEqual(clicked, ["회의록.zip"]));
    assert.equal(fetchMock.mock.calls[0]?.[0], "/api/documents/parent/export?subpages=1");
  });

  it("exports the document alone when asked to", async () => {
    const { fetchMock, user } = setup("/documents/parent", vi.fn().mockResolvedValue(fileResponse("회의록.md")));

    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Markdown (.md)" }));
    await user.click(screen.getByRole("button", { name: "이 문서만" }));

    await waitFor(() => assert.equal(fetchMock.mock.calls[0]?.[0], "/api/documents/parent/export?subpages=0"));
  });

  it("shows the server's message when the export fails", async () => {
    const { clicked, user } = setup(
      "/documents/alone",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "문서 내용을 읽지 못했습니다." }), { status: 503 })),
    );

    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "Markdown (.md)" }));

    assert.equal((await screen.findByRole("alert")).textContent, "문서 내용을 읽지 못했습니다.");
    assert.deepEqual(clicked, []);
  });

  it("prints through the browser for PDF", async () => {
    const { user } = setup("/documents/alone");
    // happy-dom has no print dialog to spy on.
    const print = vi.fn();
    Object.defineProperty(window, "print", { value: print, configurable: true });

    await openMenu(user);
    await user.click(screen.getByRole("menuitem", { name: "PDF로 인쇄" }));

    assert.equal(print.mock.calls.length, 1);
  });
});
