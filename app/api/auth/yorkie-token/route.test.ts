import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/auth/session-registry", () => ({
  sessionRegistry: { resolve: vi.fn() },
}));
vi.mock("@/lib/host-secret", () => ({ isHostSecret: vi.fn() }));
vi.mock("@/lib/auth/yorkie-token", () => ({
  HOST_SESSION_PREFIX: "host:",
  yorkieTokenRegistry: { issue: vi.fn(() => "token-abc") },
}));

import { cookies } from "next/headers";
import { sessionRegistry } from "@/lib/auth/session-registry";
import { isHostSecret } from "@/lib/host-secret";
import { yorkieTokenRegistry } from "@/lib/auth/yorkie-token";
import { GET } from "./route.ts";

afterEach(() => {
  vi.clearAllMocks();
});

const jar = (cookieValues: Record<string, string | undefined>) => ({
  get: (name: string) => (cookieValues[name] !== undefined ? { value: cookieValues[name] } : undefined),
});

describe("GET /api/auth/yorkie-token", () => {
  it("issues a token for a valid session, uncached", async () => {
    vi.mocked(cookies).mockResolvedValue(jar({ workspace_session: "session-1" }) as never);
    vi.mocked(sessionRegistry.resolve).mockReturnValue({
      id: "member-1",
      nickname: "누군가",
      colorTag: "#ef4444",
    });

    const response = await GET();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(vi.mocked(yorkieTokenRegistry.issue).mock.calls[0], ["session-1"]);
  });

  it("issues a host-prefixed token when there is no session but the host secret matches", async () => {
    vi.mocked(cookies).mockResolvedValue(jar({ role: "host-secret" }) as never);
    vi.mocked(sessionRegistry.resolve).mockReturnValue(null);
    vi.mocked(isHostSecret).mockReturnValue(true);

    const response = await GET();

    assert.equal(response.status, 200);
    assert.deepEqual(vi.mocked(yorkieTokenRegistry.issue).mock.calls[0], ["host:host-secret"]);
  });

  it("returns 401 when there is neither a session nor the host secret", async () => {
    vi.mocked(cookies).mockResolvedValue(jar({}) as never);
    vi.mocked(sessionRegistry.resolve).mockReturnValue(null);
    vi.mocked(isHostSecret).mockReturnValue(false);

    const response = await GET();

    assert.equal(response.status, 401);
  });
});
