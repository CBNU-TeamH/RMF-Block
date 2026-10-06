// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Hoisted with the mock, which runs before the imports below.
const { openFloating } = vi.hoisted(() => ({ openFloating: vi.fn() }));
vi.mock("./floating-views.tsx", () => ({ useFloatingViews: () => openFloating }));

import type { ChatMessage } from "@/lib/chat/types";
import { ChatFiles } from "./chat-files.tsx";

afterEach(() => {
  cleanup();
  openFloating.mockClear();
});

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
    render(<ChatFiles messages={messages} />);

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
    render(<ChatFiles messages={messages} />);
    assert.ok(screen.getAllByRole("listitem").every((row) => row.textContent?.includes("민수")));
  });

  it("offers a preview only for what the preview route serves inline", async () => {
    const user = userEvent.setup();
    render(<ChatFiles messages={messages} />);

    assert.equal(screen.queryByRole("button", { name: "logo.svg 미리보기" }), null);
    await user.click(screen.getByRole("button", { name: "photo.png 미리보기" }));
    assert.equal(openFloating.mock.calls[0][0].fileId, "f-1");

    await user.click(screen.getByRole("button", { name: "문서 1" }));
    assert.equal(screen.queryByRole("button", { name: "notes.zip 미리보기" }), null);
  });

  it("downloads through the opaque download route (FR-061-04)", async () => {
    const user = userEvent.setup();
    render(<ChatFiles messages={messages} />);

    await user.click(screen.getByRole("button", { name: "PDF 1" }));
    assert.equal(
      screen.getByRole("link", { name: "plan.pdf 내려받기" }).getAttribute("href"),
      "/api/files/f-3/download",
    );
  });

  it("says so when a tab is empty", () => {
    render(<ChatFiles messages={[]} />);
    assert.ok(screen.getByText("공유된 이미지 파일이 없습니다."));
  });
});
