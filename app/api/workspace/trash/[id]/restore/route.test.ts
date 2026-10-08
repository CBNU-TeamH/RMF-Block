import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";

vi.mock("@/lib/auth/current-member", () => ({ isHost: vi.fn() }));
vi.mock("@/lib/documents/documents", () => {
  class DocumentNotFoundError extends Error {}
  return { DocumentNotFoundError, restoreDocument: vi.fn() };
});
vi.mock("@/server/ws-hub.mts", () => ({ wsHub: { broadcast: vi.fn() } }));

import { isHost } from "@/lib/auth/current-member";
import { DocumentNotFoundError, restoreDocument } from "@/lib/documents/documents";
import { wsHub } from "@/server/ws-hub.mts";
import { POST } from "./route.ts";

afterEach(() => {
  vi.clearAllMocks();
});

const call = (id = "doc-1") =>
  POST(new Request("http://x", { method: "POST" }), { params: Promise.resolve({ id }) });

describe("POST /api/workspace/trash/[id]/restore", () => {
  it("refuses anyone but the host, before touching the trash", async () => {
    vi.mocked(isHost).mockResolvedValue(false);

    assert.equal((await call()).status, 401);
    assert.equal(vi.mocked(restoreDocument).mock.calls.length, 0);
  });

  it("answers 404 for an id the trash does not hold", async () => {
    vi.mocked(isHost).mockResolvedValue(true);
    vi.mocked(restoreDocument).mockImplementation(() => {
      throw new DocumentNotFoundError("nope");
    });

    assert.equal((await call()).status, 404);
  });

  it("tells every client, parent first", async () => {
    vi.mocked(isHost).mockResolvedValue(true);
    const parent = { id: "doc-1" };
    const child = { id: "doc-2" };
    vi.mocked(restoreDocument).mockReturnValue([parent, child] as never);

    const response = await call();

    assert.equal(response.status, 200);
    assert.deepEqual(vi.mocked(wsHub.broadcast).mock.calls, [
      ["document:created", { document: parent }],
      ["document:created", { document: child }],
    ]);
    assert.deepEqual(await response.json(), { ids: ["doc-1", "doc-2"] });
  });
});
