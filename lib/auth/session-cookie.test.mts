import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readSessionCookie } from "./session-cookie.ts";
import { SESSION_COOKIE } from "./types.ts";

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
