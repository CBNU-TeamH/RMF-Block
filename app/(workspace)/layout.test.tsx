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
// Not under test here — stubbed so the "gate holds open" case doesn't depend
// on real env/config reads that already have their own lib tests.
vi.mock("@/lib/yorkie-address", () => ({ yorkieClientConfig: () => ({ port: 3000 }) }));
vi.mock("@/lib/workspace-config", () => ({ getWorkspaceName: () => "workspace" }));

import { cookies } from "next/headers";
import { sessionRegistry } from "@/lib/auth/session-registry";
import { isHostSecret } from "@/lib/host-secret";
import WorkspaceLayout from "./layout.tsx";

afterEach(() => {
  vi.clearAllMocks();
});

// `isHostSecret`/`sessionRegistry.resolve` are mocked directly below, so the
// jar's actual cookie value never matters — only that `cookies()` resolves to
// something with a `.get()` the component can call.
const jar = { get: () => ({ value: "irrelevant" }) };

describe("WorkspaceLayout — auth gate", () => {
  it("redirects to /join when there is no host cookie and no session", async () => {
    vi.mocked(cookies).mockResolvedValue(jar as never);
    vi.mocked(isHostSecret).mockReturnValue(false);
    vi.mocked(sessionRegistry.resolve).mockReturnValue(null);

    await assert.rejects(
      WorkspaceLayout({ children: null }),
      /NEXT_REDIRECT;\/join/,
    );
  });

  it("does not redirect when the host cookie is present", async () => {
    vi.mocked(cookies).mockResolvedValue(jar as never);
    vi.mocked(isHostSecret).mockReturnValue(true);
    vi.mocked(sessionRegistry.resolve).mockReturnValue(null);

    await WorkspaceLayout({ children: null });
  });

  it("does not redirect when a session is present", async () => {
    vi.mocked(cookies).mockResolvedValue(jar as never);
    vi.mocked(isHostSecret).mockReturnValue(false);
    vi.mocked(sessionRegistry.resolve).mockReturnValue({
      id: "member-1",
      nickname: "누군가",
      colorTag: "#ef4444",
    });

    await WorkspaceLayout({ children: null });
  });
});
