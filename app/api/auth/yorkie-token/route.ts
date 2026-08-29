import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { sessionRegistry } from "@/lib/auth/session-registry";
import { SESSION_COOKIE } from "@/lib/auth/types";
import { HOST_SESSION_PREFIX, yorkieTokenRegistry } from "@/lib/auth/yorkie-token";
import { isHostSecret } from "@/lib/host-secret";

/**
 * Trades the workspace session for a token the browser can hand to Yorkie
 * (NFR-SEC-002/005).
 *
 * This exists because the session cookie is `httpOnly` and stays that way: a
 * token page scripts can read is a token that can be read off a shared screen
 * (UC-030). `authTokenInjector` still needs *something* to pass, so it gets a
 * narrower credential instead — see `lib/auth/yorkie-token.ts`.
 *
 * The client calls this whenever Yorkie refuses it, which the SDK does on its
 * own, so nothing here has to think about refresh.
 */
export async function GET() {
  const jar = await cookies();

  const sessionId = jar.get(SESSION_COOKIE)?.value;
  if (sessionId && sessionRegistry.resolve(sessionId)) {
    return tokenFor(sessionId);
  }

  // The host has no guest session — identity comes from having started the
  // container (`lib/host-secret.ts`) — so the bootstrap cookie stands in for
  // one. Without this the host would be the one person locked out of the
  // workspace they are running, the same asymmetry `HOST_PRESENCE` exists for.
  const role = jar.get("role")?.value;
  if (isHostSecret(role)) {
    return tokenFor(`${HOST_SESSION_PREFIX}${role}`);
  }

  return NextResponse.json({ error: "no workspace session" }, { status: 401 });
}

function tokenFor(sessionId: string) {
  const response = NextResponse.json({ token: yorkieTokenRegistry.issue(sessionId) });

  // Never cached. A token is per-session and expires; a proxy or the browser
  // holding one and replaying it to the next visitor would hand them a session
  // that is not theirs.
  response.headers.set("Cache-Control", "no-store");

  return response;
}
