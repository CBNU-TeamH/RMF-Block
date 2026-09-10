import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";

vi.mock("@/lib/auth/current-member", () => ({ currentMember: vi.fn() }));

import { currentMember } from "@/lib/auth/current-member";
import { GET } from "./route.ts";

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/files/[id]/preview — auth gate", () => {
  it("returns 401 without a member", async () => {
    vi.mocked(currentMember).mockResolvedValue(null);

    const response = await GET(new Request("http://x"), {
      params: Promise.resolve({ id: "file-1" }),
    });

    assert.equal(response.status, 401);
  });
});
