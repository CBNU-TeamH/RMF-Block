import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/auth/session-registry", () => ({
  sessionRegistry: { resolve: vi.fn() },
}));
vi.mock("@/lib/host-secret", () => ({ isHostSecret: vi.fn() }));
vi.mock("@/lib/documents/documents", () => ({ readDocuments: vi.fn(() => []) }));

import { cookies } from "next/headers";
import { sessionRegistry } from "@/lib/auth/session-registry";
import { isHostSecret } from "@/lib/host-secret";
import { DELETE, GET, PATCH } from "./route.ts";

afterEach(() => {
  vi.clearAllMocks();
});

const jar = { get: () => ({ value: "irrelevant" }) };
const params = Promise.resolve({ id: "doc-1" });
const malformedRequest = () =>
  new Request("http://x", { method: "PATCH", body: "not valid json" });

describe("/api/documents/[id] — auth gate (private requireMember())", () => {
  it("GET returns 401 without a host cookie or a session", async () => {
    vi.mocked(cookies).mockResolvedValue(jar as never);
    vi.mocked(sessionRegistry.resolve).mockReturnValue(null);
    vi.mocked(isHostSecret).mockReturnValue(false);

    const response = await GET(new Request("http://x") as never, { params });

    assert.equal(response.status, 401);
  });

  it("GET does not 401 with the host cookie and no session", async () => {
    vi.mocked(cookies).mockResolvedValue(jar as never);
    vi.mocked(sessionRegistry.resolve).mockReturnValue(null);
    vi.mocked(isHostSecret).mockReturnValue(true);

    const response = await GET(new Request("http://x") as never, { params });

    assert.notEqual(response.status, 401);
  });

  it("DELETE returns 401 without a host cookie or a session", async () => {
    vi.mocked(cookies).mockResolvedValue(jar as never);
    vi.mocked(sessionRegistry.resolve).mockReturnValue(null);
    vi.mocked(isHostSecret).mockReturnValue(false);

    const response = await DELETE(new Request("http://x") as never, { params });

    assert.equal(response.status, 401);
  });

  it("PATCH returns 401 for a malformed body when unauthenticated — auth runs before body parsing", async () => {
    vi.mocked(cookies).mockResolvedValue(jar as never);
    vi.mocked(sessionRegistry.resolve).mockReturnValue(null);
    vi.mocked(isHostSecret).mockReturnValue(false);

    const response = await PATCH(malformedRequest() as never, { params });

    assert.equal(response.status, 401);
  });

  it("PATCH returns 400 for a malformed body when authenticated", async () => {
    vi.mocked(cookies).mockResolvedValue(jar as never);
    vi.mocked(sessionRegistry.resolve).mockReturnValue(null);
    vi.mocked(isHostSecret).mockReturnValue(true);

    const response = await PATCH(malformedRequest() as never, { params });

    assert.equal(response.status, 400);
  });
});
