// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const sendToChat = vi.fn();
vi.mock("../../chat-window", () => ({ useSendToChat: () => sendToChat }));

import type { Block } from "@/lib/blocks/types";
import { BlockMenu } from "./block-menu.tsx";

const BLOCK = { id: "b-1", type: "text", text: "배포 일정" } as unknown as Block;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const choose = (item: string) => {
  fireEvent.click(screen.getByRole("button", { name: "블록 메뉴" }));
  fireEvent.click(screen.getByRole("menuitem", { name: item }));
};

describe("BlockMenu (FR-060-03)", () => {
  it("sends the block to chat with its opening text", () => {
    render(<BlockMenu documentId="doc-1" block={BLOCK} />);

    choose("채팅으로 보내기");

    assert.deepEqual(sendToChat.mock.calls, [[{ documentId: "doc-1", blockId: "b-1", excerpt: "배포 일정" }]]);
  });

  it("copies the block's address where there is no secure context, and says so", async () => {
    vi.stubGlobal("isSecureContext", false);
    let copied = "";
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: () => {
        copied = document.querySelector<HTMLTextAreaElement>("textarea[readonly]")?.value ?? "";
        return true;
      },
    });
    render(<BlockMenu documentId="doc-1" block={BLOCK} />);

    choose("링크 복사");

    assert.equal((await screen.findByRole("status")).textContent, "복사됨");
    assert.equal(copied, `${window.location.origin}/documents/doc-1#block=b-1`);
  });
});
