import assert from "node:assert/strict";
import { describe, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("./session-registry.ts", () => ({
  sessionRegistry: { resolve: vi.fn() },
}));
vi.mock("../host-secret.ts", () => ({ isHostSecret: vi.fn() }));

import { cookies } from "next/headers";
import { currentMember } from "./current-member.ts";
import { sessionRegistry } from "./session-registry.ts";
import { isHostSecret } from "../host-secret.ts";
import { HOST_PRESENCE } from "../presence/types.ts";
import { SESSION_COOKIE } from "./types.ts";

// Distinct per cookie name, on purpose: a jar that returns the same value for
// every key would pass even if the code read `role` where it meant to read
// `SESSION_COOKIE`, or vice versa.
const jar = (values: { session?: string; role?: string }) => ({
  get: (name: string) => {
    if (name === SESSION_COOKIE) return values.session ? { value: values.session } : undefined;
    if (name === "role") return values.role ? { value: values.role } : undefined;
    return undefined;
  },
});

describe("currentMember", () => {
  it("resolves to the session's member when one exists", async () => {
    vi.mocked(cookies).mockResolvedValue(jar({ session: "session-1" }) as never);
    const member = { id: "member-1", nickname: "누군가", colorTag: "#ef4444" };
    vi.mocked(sessionRegistry.resolve).mockReturnValue(member);
    vi.mocked(isHostSecret).mockReturnValue(false);

    assert.equal(await currentMember(), member);
    assert.deepEqual(vi.mocked(sessionRegistry.resolve).mock.calls[0], ["session-1"]);
  });

  it("resolves to HOST_PRESENCE when there is no session but the host secret matches", async () => {
    vi.mocked(cookies).mockResolvedValue(jar({ role: "host-secret" }) as never);
    vi.mocked(sessionRegistry.resolve).mockReturnValue(null);
    vi.mocked(isHostSecret).mockReturnValue(true);

    assert.equal(await currentMember(), HOST_PRESENCE);
    assert.deepEqual(vi.mocked(isHostSecret).mock.calls[0], ["host-secret"]);
  });

  it("resolves to null when there is neither a session nor the host secret", async () => {
    vi.mocked(cookies).mockResolvedValue(jar({}) as never);
    vi.mocked(sessionRegistry.resolve).mockReturnValue(null);
    vi.mocked(isHostSecret).mockReturnValue(false);

    assert.equal(await currentMember(), null);
  });

  it("prefers the session's member when both a session and the host secret are present", async () => {
    vi.mocked(cookies).mockResolvedValue(
      jar({ session: "session-1", role: "host-secret" }) as never,
    );
    const member = { id: "member-1", nickname: "누군가", colorTag: "#ef4444" };
    vi.mocked(sessionRegistry.resolve).mockReturnValue(member);
    vi.mocked(isHostSecret).mockReturnValue(true);

    assert.equal(await currentMember(), member);
  });
});
