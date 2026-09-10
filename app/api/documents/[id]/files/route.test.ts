import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";

vi.mock("@/lib/auth/current-member", () => ({ currentMember: vi.fn() }));

import { currentMember } from "@/lib/auth/current-member";
import { POST } from "./route.ts";

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/documents/[id]/files — auth gate", () => {
  it("returns 401 without a member, before checking the document exists", async () => {
    vi.mocked(currentMember).mockResolvedValue(null);

    const response = await POST(new Request("http://x", { method: "POST" }) as never, {
      params: Promise.resolve({ id: "doc-1" }),
    });

    assert.equal(response.status, 401);
  });
});
