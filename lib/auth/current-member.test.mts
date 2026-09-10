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

const jar = { get: () => ({ value: "irrelevant" }) };

describe("currentMember", () => {
  it("resolves to the session's member when one exists", async () => {
    vi.mocked(cookies).mockResolvedValue(jar as never);
    const member = { id: "member-1", nickname: "누군가", colorTag: "#ef4444" };
    vi.mocked(sessionRegistry.resolve).mockReturnValue(member);
    vi.mocked(isHostSecret).mockReturnValue(false);

    assert.equal(await currentMember(), member);
  });

  it("resolves to HOST_PRESENCE when there is no session but the host secret matches", async () => {
    vi.mocked(cookies).mockResolvedValue(jar as never);
    vi.mocked(sessionRegistry.resolve).mockReturnValue(null);
    vi.mocked(isHostSecret).mockReturnValue(true);

    assert.equal(await currentMember(), HOST_PRESENCE);
  });

  it("resolves to null when there is neither a session nor the host secret", async () => {
    vi.mocked(cookies).mockResolvedValue(jar as never);
    vi.mocked(sessionRegistry.resolve).mockReturnValue(null);
    vi.mocked(isHostSecret).mockReturnValue(false);

    assert.equal(await currentMember(), null);
  });
});
