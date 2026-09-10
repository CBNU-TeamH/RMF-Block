import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/auth/session-registry", () => ({
  sessionRegistry: { resolve: vi.fn() },
}));
vi.mock("@/lib/host-secret", () => ({ isHostSecret: vi.fn() }));

import { cookies } from "next/headers";
import { sessionRegistry } from "@/lib/auth/session-registry";
import { isHostSecret } from "@/lib/host-secret";
import { GET, POST } from "./route.ts";

afterEach(() => {
  vi.clearAllMocks();
});

const jar = { get: () => ({ value: "irrelevant" }) };
const malformedRequest = () =>
  new Request("http://x", { method: "POST", body: "not valid json" });

describe("/api/documents — auth gate", () => {
  it("GET returns 401 without a host cookie or a session", async () => {
    vi.mocked(cookies).mockResolvedValue(jar as never);
    vi.mocked(sessionRegistry.resolve).mockReturnValue(null);
    vi.mocked(isHostSecret).mockReturnValue(false);

    const response = await GET();

    assert.equal(response.status, 401);
  });

  it("GET succeeds with a session and no host cookie", async () => {
    vi.mocked(cookies).mockResolvedValue(jar as never);
    vi.mocked(sessionRegistry.resolve).mockReturnValue({
      id: "member-1",
      nickname: "누군가",
      colorTag: "#ef4444",
    });
    vi.mocked(isHostSecret).mockReturnValue(false);

    const response = await GET();

    assert.equal(response.status, 200);
  });

  it("POST returns 401 for a malformed body when unauthenticated — auth runs before body parsing", async () => {
    vi.mocked(cookies).mockResolvedValue(jar as never);
    vi.mocked(sessionRegistry.resolve).mockReturnValue(null);
    vi.mocked(isHostSecret).mockReturnValue(false);

    const response = await POST(malformedRequest() as never);

    assert.equal(response.status, 401);
  });

  it("POST returns 400 for a malformed body when authenticated", async () => {
    vi.mocked(cookies).mockResolvedValue(jar as never);
    vi.mocked(sessionRegistry.resolve).mockReturnValue(null);
    vi.mocked(isHostSecret).mockReturnValue(true);

    const response = await POST(malformedRequest() as never);

    assert.equal(response.status, 400);
  });
});
