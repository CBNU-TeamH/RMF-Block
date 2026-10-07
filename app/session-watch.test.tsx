// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace }) }));

import { SessionWatch } from "./session-watch.tsx";

/** Hands the test the listener the component registers, so a frame can be
 *  delivered without a server. */
let deliver: (data: string) => void = () => undefined;
class FakeWebSocket {
  addEventListener(_type: string, listener: (event: { data: string }) => void) {
    deliver = (data) => listener({ data });
  }
  close() {}
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("SessionWatch", () => {
  it("sends a kicked guest to the join screen with the reason (UC-011 step 5)", () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    render(<SessionWatch />);

    deliver(JSON.stringify({ event: "session:revoked", payload: { reason: "kicked" } }));
    assert.equal(replace.mock.calls[0]?.[0], "/join?reason=kicked");
  });

  it("sends a displaced device to the join screen without one (FR-020-08)", () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    render(<SessionWatch />);

    deliver(JSON.stringify({ event: "session:revoked", payload: null }));
    assert.equal(replace.mock.calls[0]?.[0], "/join");
  });
});
