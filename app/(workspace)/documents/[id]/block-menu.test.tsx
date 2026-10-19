// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const sendToChat = vi.fn();
vi.mock("../../chat-window", () => ({ useSendToChat: () => sendToChat }));

import { BlockMenu } from "./block-menu.tsx";

const menu = <BlockMenu documentId="doc-1" blockId="b-1" readExcerpt={() => "배포 일정"} />;

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
  it("sends the block to chat with its opening text, read when sent", () => {
    render(menu);

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
    render(menu);

    choose("링크 복사");

    assert.equal((await screen.findByRole("status")).textContent, "복사됨");
    assert.equal(copied, `${window.location.origin}/documents/doc-1#block=b-1`);
  });
});
