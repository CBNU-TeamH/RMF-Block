import assert from "node:assert/strict";
import { describe, it, vi } from "vitest";

vi.mock("./session-registry.ts", () => ({ sessionRegistry: { resolve: vi.fn() } }));
vi.mock("../host-secret.ts", () => ({ isHostSecret: vi.fn() }));

import { isAuthenticatedSocket, readCookie, readSessionCookie } from "./session-cookie.ts";
import { sessionRegistry } from "./session-registry.ts";
import { SESSION_COOKIE } from "./types.ts";
import { isHostSecret } from "../host-secret.ts";

describe("readSessionCookie", () => {
  it("reads the session from a lone cookie", () => {
    assert.equal(readSessionCookie(`${SESSION_COOKIE}=abc123`), "abc123");
  });

  it("finds it among other cookies", () => {
    assert.equal(
      readSessionCookie(`role=secret; ${SESSION_COOKIE}=abc123; theme=dark`),
      "abc123",
    );
  });

  it("keeps a value containing '='", () => {
    // Splitting on every '=' instead of the first would truncate a base64 value.
    assert.equal(readSessionCookie(`${SESSION_COOKIE}=a=b=c`), "a=b=c");
  });

  it("decodes a percent-encoded value", () => {
    assert.equal(readSessionCookie(`${SESSION_COOKIE}=a%20b`), "a b");
  });

  it("returns null when absent, empty, or headerless", () => {
    assert.equal(readSessionCookie("role=secret"), null);
    assert.equal(readSessionCookie(`${SESSION_COOKIE}=`), null);
    assert.equal(readSessionCookie(""), null);
    assert.equal(readSessionCookie(undefined), null);
  });

  it("does not match a cookie whose name merely ends with ours", () => {
    assert.equal(readSessionCookie(`not_${SESSION_COOKIE}=abc123`), null);
  });

  it("does not throw on a malformed escape", () => {
    // This runs inside the `upgrade` handler in `server/index.mts`, where a
    // throw is an uncaught exception and kills the process. Anyone on the LAN
    // can send this header.
    assert.equal(readSessionCookie(`${SESSION_COOKIE}=%`), null);
    assert.equal(readSessionCookie(`${SESSION_COOKIE}=%E0%A4%A`), null);
    assert.equal(readSessionCookie(`role=x; ${SESSION_COOKIE}=%zz`), null);
  });
});

describe("readCookie", () => {
  it("reads a cookie other than the session one by name", () => {
    assert.equal(readCookie(`${SESSION_COOKIE}=abc; role=host-secret`, "role"), "host-secret");
  });

  it("returns null when the named cookie is absent", () => {
    assert.equal(readCookie(`${SESSION_COOKIE}=abc`, "role"), null);
  });
});

describe("isAuthenticatedSocket", () => {
  it("is true when the given session id resolves to a live member", () => {
    vi.mocked(sessionRegistry.resolve).mockReturnValue({
      id: "member-1",
      nickname: "누군가",
      colorTag: "#ef4444",
    });
    vi.mocked(isHostSecret).mockReturnValue(false);

    assert.equal(isAuthenticatedSocket("session-1", `${SESSION_COOKIE}=session-1`), true);
    assert.deepEqual(vi.mocked(sessionRegistry.resolve).mock.calls[0], ["session-1"]);
  });

  it("is true when there is no session but the role cookie matches the host secret", () => {
    vi.mocked(sessionRegistry.resolve).mockReturnValue(null);
    vi.mocked(isHostSecret).mockReturnValue(true);

    assert.equal(isAuthenticatedSocket(null, "role=host-secret"), true);
    assert.deepEqual(vi.mocked(isHostSecret).mock.calls[0], ["host-secret"]);
  });

  it("is false when neither a live session nor the host secret is present", () => {
    vi.mocked(sessionRegistry.resolve).mockReturnValue(null);
    vi.mocked(isHostSecret).mockReturnValue(false);

    assert.equal(isAuthenticatedSocket(null, "theme=dark"), false);
  });
});
