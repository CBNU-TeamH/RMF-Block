// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./presence-provider.tsx", () => ({ useWorkspacePresence: () => ({ members: [] }) }));
vi.mock("./floating-views.tsx", () => ({ useFloatingViews: () => vi.fn() }));

import { ChatPanel } from "./chat-panel.tsx";

class QuietSocket {
  addEventListener() {}
  close() {}
}

/** Opens at once, which is what makes the panel fetch its history. */
class OpeningSocket {
  addEventListener(type: string, listener: () => void) {
    if (type === "open") queueMicrotask(listener);
  }
  close() {}
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ChatPanel", () => {
  // A guest opens http://<LAN-IP>:3000, which is not a secure context, so the
  // browser has no crypto.randomUUID there. Every send used to throw before the POST.
  it("sends a message where crypto.randomUUID does not exist", async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
      Response.json(
        init?.method === "POST"
          ? { id: "m1", sender: "지은", text: "안녕", sentAt: "2026-10-16T00:00:00.000Z" }
          : [],
      ),
    );
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("WebSocket", QuietSocket);
    vi.stubGlobal("crypto", { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });

    const user = userEvent.setup();
    render(<ChatPanel me="지은" />);
    await user.type(screen.getByRole("textbox", { name: "채팅 메시지" }), "안녕{Enter}");

    await waitFor(() =>
      assert.ok(fetch.mock.calls.some(([url, init]) => url === "/api/chat" && init?.method === "POST")),
    );
  });

  // UC-050 E3-3: the file manager opens the window at a message.
  it("lands on a message from the history, out of the file list, and highlights it", async () => {
    const history = [
      { id: "m1", sender: "지은", text: "첫 메시지", sentAt: "2026-10-15T00:00:00.000Z" },
      { id: "m2", sender: "민수", text: "", sentAt: "2026-10-15T01:00:00.000Z", attachment: { fileId: "f", fileName: "photo.jpg", fileType: "image/jpeg", size: 3 } },
    ];
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(history)));
    vi.stubGlobal("WebSocket", OpeningSocket);
    const flashed: Array<string | undefined> = [];
    const original = HTMLElement.prototype.animate;
    HTMLElement.prototype.animate = function (this: HTMLElement) {
      flashed.push(this.dataset.messageId);
      return {} as Animation;
    };
    try {
      const onLanded = vi.fn();
      const { rerender } = render(<ChatPanel me="지은" landOn={null} onLanded={onLanded} />);
      fireEvent.click(screen.getByRole("button", { name: "파일" }));

      rerender(<ChatPanel me="지은" landOn="m2" onLanded={onLanded} />);

      await waitFor(() => assert.equal(onLanded.mock.calls.length, 1));
      assert.equal(screen.getByRole("button", { name: "대화" }).getAttribute("aria-pressed"), "true");
      assert.deepEqual(flashed, ["m2"]);
    } finally {
      HTMLElement.prototype.animate = original;
    }
  });
});
