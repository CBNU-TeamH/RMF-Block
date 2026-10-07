import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";

vi.mock("@/lib/workspace-config", () => ({ isWorkspaceOpen: vi.fn(), isWorkspacePassword: vi.fn() }));
vi.mock("@/lib/auth/session-registry", () => ({ sessionRegistry: { join: vi.fn(), hasLiveSession: vi.fn() } }));
vi.mock("@/server/ws-hub.mts", () => ({ wsHub: { revoke: vi.fn() } }));

import { isWorkspaceOpen, isWorkspacePassword } from "@/lib/workspace-config";
import { sessionRegistry } from "@/lib/auth/session-registry";
import { POST } from "./route.ts";

afterEach(() => {
  vi.clearAllMocks();
});

const join = () =>
  POST(new Request("http://x", { method: "POST", body: JSON.stringify({ nickname: "a", password: "1234" }) }) as never);

describe("POST /api/workspace/join before setup (UC-010)", () => {
  it("answers 503 and never checks the password or joins", async () => {
    vi.mocked(isWorkspaceOpen).mockReturnValue(false);

    const response = await join();

    assert.equal(response.status, 503);
    assert.equal(vi.mocked(isWorkspacePassword).mock.calls.length, 0);
    assert.equal(vi.mocked(sessionRegistry.join).mock.calls.length, 0);
  });

  it("checks the password once the workspace is open", async () => {
    vi.mocked(isWorkspaceOpen).mockReturnValue(true);
    vi.mocked(isWorkspacePassword).mockResolvedValue(false);

    assert.equal((await join()).status, 401);
  });
});
