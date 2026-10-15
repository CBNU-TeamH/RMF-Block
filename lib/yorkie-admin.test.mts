import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";

import { registerAuthWebhook, YorkieAdminError } from "./yorkie-admin.ts";

const ADDR = "http://yorkie:8080";
const WEBHOOK = "http://app:3000/api/internal/yorkie/auth";
const ONCE = { attempts: 1, delayMs: 0 };
const CONFIGURED = "Configured-pass-1";

type Call = { method: string; body: Record<string, string>; auth: string | null };

/** Yorkie's Admin API as far as startup touches it. `stored` is the admin
 *  password the volume holds, which `ChangePassword` rewrites. */
function fakeYorkie(stored: string) {
  const calls: Array<Call> = [];
  const json = (status: number, value: object) => new Response(JSON.stringify(value), { status });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const method = url.slice(url.lastIndexOf("/") + 1);
      const body = JSON.parse(String(init.body));
      calls.push({ method, body, auth: new Headers(init.headers).get("Authorization") });
      if (method === "LogIn") {
        return body.password === stored ? json(200, { token: `token-for-${stored}` }) : json(401, {});
      }
      if (method === "ChangePassword") {
        if (body.currentPassword !== stored) return json(401, {});
        stored = body.newPassword;
      }
      return json(200, {});
    }),
  );
  return { calls, stored: () => stored };
}

describe("registerAuthWebhook", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("logs in with YORKIE_ADMIN_PASSWORD and registers the webhook under that token", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("YORKIE_ADMIN_PASSWORD", CONFIGURED);
    const yorkie = fakeYorkie(CONFIGURED);

    await registerAuthWebhook(ADDR, WEBHOOK, ONCE);

    assert.deepEqual(yorkie.calls.map((call) => call.method), ["LogIn", "UpdateProject"]);
    assert.deepEqual(yorkie.calls[0].body, { username: "admin", password: CONFIGURED });
    assert.equal(yorkie.calls[1].auth, `Bearer token-for-${CONFIGURED}`);
    assert.equal((yorkie.calls[1].body.fields as unknown as { authWebhookUrl: string }).authWebhookUrl, WEBHOOK);
  });

  for (const [label, value] of [["unset", ""], ["Yorkie's default", "admin"]]) {
    it(`refuses in production when the password is ${label}, before calling Yorkie`, async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("YORKIE_ADMIN_PASSWORD", value);
      const yorkie = fakeYorkie("admin");

      await assert.rejects(registerAuthWebhook(ADDR, WEBHOOK, ONCE), YorkieAdminError);
      assert.equal(yorkie.calls.length, 0);
    });
  }

  it("uses Yorkie's default outside production, for a hand-started Yorkie", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("YORKIE_ADMIN_PASSWORD", "");
    const yorkie = fakeYorkie("admin");

    await registerAuthWebhook(ADDR, WEBHOOK, ONCE);

    assert.equal(yorkie.calls[0].body.password, "admin");
    assert.equal(yorkie.calls.at(-1)?.method, "UpdateProject");
  });

  it("moves a volume still on the default onto the configured password", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("YORKIE_ADMIN_PASSWORD", CONFIGURED);
    vi.spyOn(console, "log").mockImplementation(() => {});
    const yorkie = fakeYorkie("admin");

    await registerAuthWebhook(ADDR, WEBHOOK, ONCE);

    assert.deepEqual(yorkie.calls.map((call) => call.method), [
      "LogIn",
      "LogIn",
      "ChangePassword",
      "LogIn",
      "UpdateProject",
    ]);
    assert.deepEqual(yorkie.calls[2].body, {
      username: "admin",
      currentPassword: "admin",
      newPassword: CONFIGURED,
    });
    assert.equal(yorkie.stored(), CONFIGURED);
    assert.equal(yorkie.calls[4].auth, `Bearer token-for-${CONFIGURED}`);
  });

  it("fails on the configured login when the default is refused too, changing nothing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("YORKIE_ADMIN_PASSWORD", CONFIGURED);
    const yorkie = fakeYorkie("Some-other-pass-1");

    await assert.rejects(registerAuthWebhook(ADDR, WEBHOOK, ONCE), /LogIn failed \(401\)/);
    assert.deepEqual(yorkie.calls.map((call) => call.method), ["LogIn", "LogIn"]);
    assert.equal(yorkie.stored(), "Some-other-pass-1");
  });

  it("does not retry a password Yorkie refused", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("YORKIE_ADMIN_PASSWORD", CONFIGURED);
    const yorkie = fakeYorkie("Some-other-pass-1");

    await assert.rejects(registerAuthWebhook(ADDR, WEBHOOK, { attempts: 3, delayMs: 0 }), /LogIn failed \(401\)/);
    assert.equal(yorkie.calls.length, 2);
  });
});
