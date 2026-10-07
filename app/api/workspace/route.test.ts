import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";

vi.mock("@/lib/auth/current-member", () => ({ isHost: vi.fn() }));
vi.mock("@/lib/workspace-config", async (actual) => ({
  ...(await actual<typeof import("@/lib/workspace-config")>()),
  openWorkspace: vi.fn(),
  changeWorkspacePassword: vi.fn(),
  isWorkspaceOpen: vi.fn(() => false),
}));
vi.mock("@/lib/auth/session-registry", () => ({ sessionRegistry: { kick: vi.fn() } }));
vi.mock("@/server/ws-hub.mts", () => ({ wsHub: { revoke: vi.fn() } }));

import { isHost } from "@/lib/auth/current-member";
import { sessionRegistry } from "@/lib/auth/session-registry";
import {
  WorkspaceConfigError,
  changeWorkspacePassword,
  isWorkspaceOpen,
  openWorkspace,
} from "@/lib/workspace-config";
import { wsHub } from "@/server/ws-hub.mts";
import { DELETE } from "./members/[id]/route.ts";
import { PATCH } from "./password/route.ts";
import { POST } from "./route.ts";

afterEach(() => {
  vi.clearAllMocks();
});

const json = (body: unknown) =>
  new Request("http://x", { method: "POST", body: JSON.stringify(body) }) as never;
const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("host-only workspace routes (FR-011-07)", () => {
  it("refuse a guest before doing anything", async () => {
    vi.mocked(isHost).mockResolvedValue(false);

    assert.equal((await POST(json({ password: "1234" }))).status, 401);
    assert.equal((await PATCH(json({ password: "1234" }))).status, 401);
    assert.equal((await DELETE(new Request("http://x"), params("m-1"))).status, 401);
    assert.equal(vi.mocked(openWorkspace).mock.calls.length, 0);
    assert.equal(vi.mocked(changeWorkspacePassword).mock.calls.length, 0);
    assert.equal(vi.mocked(sessionRegistry.kick).mock.calls.length, 0);
  });
});

describe("POST /api/workspace — setup (FR-010-01~04)", () => {
  it("opens the workspace", async () => {
    vi.mocked(isHost).mockResolvedValue(true);

    const response = await POST(json({ name: "Team H", password: "1234" }));

    assert.equal(response.status, 204);
    assert.deepEqual(vi.mocked(openWorkspace).mock.calls[0]?.[0], { name: "Team H", password: "1234" });
  });

  it("maps an already-open workspace to 409 and bad input to 400", async () => {
    vi.mocked(isHost).mockResolvedValue(true);

    vi.mocked(isWorkspaceOpen).mockReturnValueOnce(true);
    assert.equal((await POST(json({ password: "1234" }))).status, 409);
    assert.equal(vi.mocked(openWorkspace).mock.calls.length, 0);

    vi.mocked(openWorkspace).mockRejectedValueOnce(new WorkspaceConfigError("짧음"));
    assert.equal((await POST(json({ password: "1" }))).status, 400);
  });
});

describe("PATCH /api/workspace/password (FR-011-04~06)", () => {
  it("changes the password without touching any session", async () => {
    vi.mocked(isHost).mockResolvedValue(true);

    const response = await PATCH(json({ password: "5678" }));

    assert.equal(response.status, 204);
    assert.equal(vi.mocked(changeWorkspacePassword).mock.calls[0]?.[0], "5678");
    assert.equal(vi.mocked(sessionRegistry.kick).mock.calls.length, 0);
  });

  it("maps a too-short password to 400", async () => {
    vi.mocked(isHost).mockResolvedValue(true);
    vi.mocked(changeWorkspacePassword).mockRejectedValueOnce(new WorkspaceConfigError("짧음"));

    assert.equal((await PATCH(json({ password: "1" }))).status, 400);
  });
});

describe("DELETE /api/workspace/members/:id — kick (FR-011-01/03)", () => {
  it("ends the session and tells its sockets why", async () => {
    vi.mocked(isHost).mockResolvedValue(true);
    vi.mocked(sessionRegistry.kick).mockReturnValue("session-1");

    const response = await DELETE(new Request("http://x"), params("m-1"));

    assert.equal(response.status, 204);
    assert.equal(vi.mocked(sessionRegistry.kick).mock.calls[0]?.[0], "m-1");
    assert.deepEqual(vi.mocked(wsHub.revoke).mock.calls[0], ["session-1", "kicked"]);
  });

  it("answers 404 for someone not connected", async () => {
    vi.mocked(isHost).mockResolvedValue(true);
    vi.mocked(sessionRegistry.kick).mockReturnValue(null);

    assert.equal((await DELETE(new Request("http://x"), params("m-1"))).status, 404);
    assert.equal(vi.mocked(wsHub.revoke).mock.calls.length, 0);
  });
});
