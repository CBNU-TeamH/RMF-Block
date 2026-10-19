import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";

import { readDocumentRoots, registerAuthWebhook, YorkieAdminError } from "./yorkie-admin.ts";

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

describe("readDocumentRoots", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  /** LogIn → GetProject → GetDocuments, with what each was authorized by. */
  function fakeAdmin(project: object = { secretKey: "project-secret" }) {
    const calls: Array<Call> = [];
    const json = (status: number, value: object) => new Response(JSON.stringify(value), { status });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        const method = url.slice(url.lastIndexOf("/") + 1);
        const body = JSON.parse(String(init.body));
        calls.push({ method, body, auth: new Headers(init.headers).get("Authorization") });
        if (method === "LogIn") return json(200, { token: "admin-token" });
        if (method === "GetProject") return json(200, { project });
        return json(200, { documents: [{ key: "doc-a", root: '{"blocks":[]}' }] });
      }),
    );
    return calls;
  }

  it("reads the roots with the project's secret key, not the admin token", async () => {
    vi.stubEnv("YORKIE_ADMIN_PASSWORD", CONFIGURED);
    const calls = fakeAdmin();

    const roots = await readDocumentRoots(ADDR, ["doc-a", "never-opened"]);

    assert.deepEqual(calls.map((call) => [call.method, call.auth]), [
      ["LogIn", null],
      ["GetProject", "Bearer admin-token"],
      ["GetDocuments", "API-Key project-secret"],
    ]);
    assert.deepEqual(calls[2]?.body, { documentKeys: ["doc-a", "never-opened"], includeRoot: true });
    assert.deepEqual([...roots], [["doc-a", '{"blocks":[]}']]);
  });

  it("asks Yorkie nothing for an empty catalogue", async () => {
    const calls = fakeAdmin();

    assert.equal((await readDocumentRoots(ADDR, [])).size, 0);
    assert.equal(calls.length, 0);
  });

  it("fails when the project comes back without a secret key", async () => {
    vi.stubEnv("YORKIE_ADMIN_PASSWORD", CONFIGURED);
    fakeAdmin({});

    await assert.rejects(readDocumentRoots(ADDR, ["doc-a"]), YorkieAdminError);
  });
});
