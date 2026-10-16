// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./presence-provider.tsx", () => ({ useWorkspacePresence: () => ({ members: [] }) }));
vi.mock("./floating-views.tsx", () => ({ useFloatingViews: () => vi.fn() }));

import { ChatPanel } from "./chat-panel.tsx";

class QuietSocket {
  addEventListener() {}
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
});
