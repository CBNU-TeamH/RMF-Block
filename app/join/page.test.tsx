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
const config = { open: true };
vi.mock("@/lib/workspace-config", () => ({ getWorkspaceName: () => "workspace", isWorkspaceOpen: () => config.open }));

import { cookies } from "next/headers";
import { sessionRegistry } from "@/lib/auth/session-registry";
import { isHostSecret } from "@/lib/host-secret";
import JoinPage from "./page.tsx";

afterEach(() => {
  vi.clearAllMocks();
  config.open = true;
});

const jar = { get: () => ({ value: "irrelevant" }) };
const noParams = { searchParams: Promise.resolve({}) };

describe("JoinPage — already-signed-in redirect", () => {
  it("redirects home when the host cookie is present", async () => {
    vi.mocked(cookies).mockResolvedValue(jar as never);
    vi.mocked(isHostSecret).mockReturnValue(true);
    vi.mocked(sessionRegistry.resolve).mockReturnValue(null);

    await assert.rejects(JoinPage(noParams), /NEXT_REDIRECT;\//);
  });

  it("redirects home when a session already exists", async () => {
    vi.mocked(cookies).mockResolvedValue(jar as never);
    vi.mocked(isHostSecret).mockReturnValue(false);
    vi.mocked(sessionRegistry.resolve).mockReturnValue({
      id: "member-1",
      nickname: "누군가",
      colorTag: "#ef4444",
    });

    await assert.rejects(JoinPage(noParams), /NEXT_REDIRECT;\//);
  });
});

/** Every node of a rendered server component, flattened, so a test can ask
 *  whether some text or component appears without a DOM. */
function texts(node: unknown): Array<unknown> {
  if (node == null || typeof node === "boolean") return [];
  if (Array.isArray(node)) return node.flatMap(texts);
  if (typeof node === "object" && "props" in node) {
    const element = node as { type: unknown; props: { children?: unknown } };
    return [element.type, ...texts(element.props.children)];
  }
  return [node];
}

describe("JoinPage — what a signed-out visitor sees", () => {
  const signedOut = () => {
    vi.mocked(cookies).mockResolvedValue(jar as never);
    vi.mocked(isHostSecret).mockReturnValue(false);
    vi.mocked(sessionRegistry.resolve).mockReturnValue(null);
  };

  it("tells a kicked guest so (UC-011 step 5)", async () => {
    signedOut();
    const page = await JoinPage({ searchParams: Promise.resolve({ reason: "kicked" }) });
    assert.ok(texts(page).includes("워크스페이스에서 퇴장되었습니다."));
  });

  it("shows no form before the host has opened the workspace (UC-010)", async () => {
    signedOut();
    config.open = false;
    const page = await JoinPage(noParams);
    const nodes = texts(page);
    assert.ok(nodes.some((n) => typeof n === "string" && n.includes("아직 워크스페이스를 열지 않았습니다")));
    assert.equal(nodes.some((n) => typeof n === "function" && n.name === "JoinForm"), false);
  });
});
