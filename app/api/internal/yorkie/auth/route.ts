import { NextResponse, type NextRequest } from "next/server";

import { sessionRegistry } from "@/lib/auth/session-registry";
import { HOST_SESSION_PREFIX, yorkieTokenRegistry } from "@/lib/auth/yorkie-token";

/**
 * Yorkie's auth webhook (`docs/design/api.md` §2). Yorkie calls this before
 * letting a client act, and refuses the operation when the answer is no — so
 * this is what finally closes the hole that made port 8080 open to the LAN.
 *
 * The contract is Yorkie's, not ours: `{ token, method, attributes }` in,
 * `{ allowed, reason }` out. A refusal's `reason` is not just a log line —
 * measured against 0.7.13, the SDK passes it to the client's
 * `authTokenInjector` — so the two refusals below are worded for whoever reads
 * them there. "expired" means fetch another; "revoked" means the session itself
 * is gone and another token will not help.
 *
 * Deliberately unsigned. Anything on the LAN can call this, and all it can learn
 * is whether a token it already holds is valid — see the task doc's Cut list.
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
 * **401, not 200.** Yorkie pairs the status with the body and accepts only three
 * combinations (`server/rpc/auth/webhook.go`, `handleWebhookResponse`): `200` +
 * allowed, `403` + refused, `401` + refused. Anything else — including a `200`
 * carrying `allowed: false` — falls through to its `default` branch and becomes
 * `ErrInvalidJSONResponse`, which is a *malfunction* rather than a refusal.
 *
 * 401 over 403 because both refusals here are about identity, not permission:
 * the caller has not shown a token this server issued, or the session behind it
 * is gone. There is nothing they are being denied *access to* — there is nobody
 * asking yet. It also happens to be the branch Yorkie does not cache, so a
 * refusal is re-asked every time instead of being pinned for the cache TTL.
 */
const deny = (reason: string) =>
  NextResponse.json({ allowed: false, reason }, { status: 401 });
