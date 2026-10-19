// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const goToBlock = vi.fn();
vi.mock("./focus-follow-provider.tsx", () => ({ useFocusFollow: () => ({ goToBlock }) }));
vi.mock("./floating-views.tsx", () => ({ useFloatingViews: () => vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import type { ChatMessage } from "@/lib/chat/types";
import { ChatFiles } from "./chat-files.tsx";

const NAMES = new Map([["doc-1", "회의록"]]);

afterEach(cleanup);

const sent = (id: string, fileName: string, fileType: string): ChatMessage => ({
  id,
  sender: "민수",
  text: "",
  sentAt: `2026-10-06T0${id}:00:00.000Z`,
  attachment: { fileId: `f-${id}`, fileName, fileType, size: 2048 },
});

const messages = [
  sent("1", "photo.png", "image/png"),
  sent("2", "logo.svg", "image/svg+xml"),
  sent("3", "plan.pdf", "application/pdf"),
  sent("4", "notes.zip", "application/zip"),
  { id: "5", sender: "지은", text: "안녕", sentAt: "2026-10-06T05:00:00.000Z" },
];

describe("ChatFiles", () => {
  it("counts each tab and opens on images, newest first", () => {
    render(<ChatFiles messages={messages} names={NAMES} />);

    assert.deepEqual(
      ["이미지 2", "PDF 1", "문서 1"].map((name) => screen.getByRole("button", { name }).getAttribute("aria-pressed")),
      ["true", "false", "false"],
    );
    assert.deepEqual(
      screen.getAllByRole("listitem").map((row) => row.textContent?.split("이미지")[0]),
      ["logo.svg", "photo.png"],
    );
  });

  it("shows the sender beside each file (FR-061-02)", () => {
    render(<ChatFiles messages={messages} names={NAMES} />);
    assert.ok(screen.getAllByRole("listitem").every((row) => row.textContent?.includes("민수")));
  });

  it("offers a preview only for what the preview route serves inline", async () => {
    const user = userEvent.setup();
    render(<ChatFiles messages={messages} names={NAMES} />);

    assert.equal(screen.queryByRole("button", { name: "logo.svg 미리보기" }), null);
    await user.click(screen.getByRole("button", { name: "photo.png 미리보기" }));
    const dialog = screen.getByRole("dialog", { hidden: true }) as HTMLDialogElement;
    assert.equal(dialog.open, true);
    assert.equal(dialog.getAttribute("aria-label"), "photo.png 미리보기");
    await user.click(within(dialog).getByRole("button", { name: "닫기", hidden: true }));

    await user.click(screen.getByRole("button", { name: "문서 1" }));
    assert.equal(screen.queryByRole("button", { name: "notes.zip 미리보기" }), null);
  });

  it("downloads through the opaque download route (FR-061-04)", async () => {
    const user = userEvent.setup();
    render(<ChatFiles messages={messages} names={NAMES} />);

    await user.click(screen.getByRole("button", { name: "PDF 1" }));
    assert.equal(
      screen.getByRole("link", { name: "plan.pdf 내려받기" }).getAttribute("href"),
      "/api/files/f-3/download",
    );
  });

  it("says so when a tab is empty", () => {
    render(<ChatFiles messages={[]} names={NAMES} />);
    assert.ok(screen.getByText("공유된 이미지 파일이 없습니다."));
  });
});

describe("ChatFiles — the 링크 tab (FR-061-01)", () => {
  const links: Array<ChatMessage> = [
    { id: "l1", sender: "민수", text: "보세요 https://example.com", sentAt: "2026-10-19T01:00:00.000Z" },
    {
      id: "l2",
      sender: "지은",
      text: "",
      link: { documentId: "doc-1", blockId: "b-1", documentName: "옛 이름", excerpt: "배포 일정" },
      sentAt: "2026-10-19T02:00:00.000Z",
    },
    { id: "l3", sender: "지은", text: "", link: { documentId: "gone", documentName: "지운 문서" }, sentAt: "2026-10-19T03:00:00.000Z" },
  ];

  it("lists document and block links and URLs, newest first, and opens them", () => {
    render(<ChatFiles messages={links} names={NAMES} />);
    fireEvent.click(screen.getByRole("button", { name: "링크 3" }));

    assert.deepEqual(
      screen.getAllByRole("listitem").map((row) => row.textContent?.split("·")[0].trim()),
      ["지운 문서삭제된 문서", "회의록 › 배포 일정블록", "https://example.comURL"],
    );
    assert.equal((screen.getByRole("button", { name: "지운 문서 열기" }) as HTMLButtonElement).disabled, true);
    assert.equal(screen.getByRole("link", { name: "https://example.com 열기" }).getAttribute("target"), "_blank");

    fireEvent.click(screen.getByRole("button", { name: "회의록 › 배포 일정 열기" }));
    assert.deepEqual(goToBlock.mock.calls, [["doc-1", "b-1"]]);
  });
});
