import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT;${url}`);
  }),
}));
vi.mock("@/lib/auth/session-registry", () => ({
  sessionRegistry: { resolve: vi.fn() },
}));
vi.mock("@/lib/host-secret", () => ({ isHostSecret: vi.fn() }));
vi.mock("@/lib/workspace-config", () => ({ getWorkspaceName: () => "workspace" }));

import { cookies } from "next/headers";
import { sessionRegistry } from "@/lib/auth/session-registry";
import { isHostSecret } from "@/lib/host-secret";
import JoinPage from "./page.tsx";

afterEach(() => {
  vi.clearAllMocks();
});

const jar = { get: () => ({ value: "irrelevant" }) };

describe("JoinPage — already-signed-in redirect", () => {
  it("redirects home when the host cookie is present", async () => {
    vi.mocked(cookies).mockResolvedValue(jar as never);
    vi.mocked(isHostSecret).mockReturnValue(true);
    vi.mocked(sessionRegistry.resolve).mockReturnValue(null);

    await assert.rejects(JoinPage(), /NEXT_REDIRECT;\//);
  });

  it("redirects home when a session already exists", async () => {
    vi.mocked(cookies).mockResolvedValue(jar as never);
    vi.mocked(isHostSecret).mockReturnValue(false);
    vi.mocked(sessionRegistry.resolve).mockReturnValue({
      id: "member-1",
      nickname: "누군가",
      colorTag: "#ef4444",
    });

    await assert.rejects(JoinPage(), /NEXT_REDIRECT;\//);
  });
});
