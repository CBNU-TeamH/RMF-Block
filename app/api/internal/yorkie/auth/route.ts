import { NextResponse, type NextRequest } from "next/server";

import { sessionRegistry } from "@/lib/auth/session-registry";
import { HOST_SESSION_PREFIX, yorkieTokenRegistry } from "@/lib/auth/yorkie-token";

/**
 * Yorkie's auth webhook (`docs/design/api.md` §2) — what closes the hole that
 * left port 8080 open to the LAN.
 *
 * The contract is Yorkie's: `{ token, method, attributes }` in,
 * `{ allowed, reason }` out. A refusal's `reason` reaches the client — measured
 * against 0.7.13, the SDK hands it to `authTokenInjector` — so the two below
 * are worded for that reader: "expired" means fetch another, "revoked" means
 * another will not help.
 *
 * Deliberately unsigned: anything on the LAN can call it, and all it can learn
 * is whether a token it already holds is valid.
 */
export async function POST(request: NextRequest) {
  let body: { token?: unknown };
  try {
    body = await request.json();
  } catch {
    return deny("malformed webhook request");
  }

  const token = typeof body.token === "string" ? body.token : undefined;

  // Yorkie sends `token: ""` for a client that supplied no injector at all,
  // which is exactly the case this endpoint exists to stop.
  const sessionId = yorkieTokenRegistry.resolve(token);
  if (!sessionId) {
    return deny("token expired");
  }

  // The host holds no guest session, so `sessionRegistry` would refuse them —
  // the prefix is how their token skips a lookup that can only fail. Nothing is
  // re-checked here: the token route already matched the bootstrap secret before
  // issuing, and only that route writes to the registry. Re-matching it would
  // guard against a stale secret outliving its token, which cannot happen —
  // the secret and the registry are both process memory and a restart clears
  // both together.
  if (sessionId.startsWith(HOST_SESSION_PREFIX)) {
    return allow();
  }

  // A live token is not a live session. A device displaced by another
  // (FR-020-08) keeps a perfectly valid token, and this is where it stops
  // counting — which is why tokens point at sessions rather than at members.
  if (!sessionRegistry.resolve(sessionId)) {
    return deny("session revoked");
  }

  return allow();
}

const allow = () => NextResponse.json({ allowed: true, reason: "" });

/**
 * **401, not 200.** Yorkie pairs status with body and accepts only three
 * combinations (`server/rpc/auth/webhook.go`): 200+allowed, 403+refused,
 * 401+refused. Anything else — a 200 carrying `allowed: false` included —
 * becomes `ErrInvalidJSONResponse`, a malfunction rather than a refusal.
 *
 * 401 over 403 because both refusals here are about identity, not permission —
 * and it is the branch Yorkie does not cache, so a refusal is re-asked rather
 * than pinned for the cache TTL.
 */
const deny = (reason: string) =>
  NextResponse.json({ allowed: false, reason }, { status: 401 });
