import { NextResponse, type NextRequest } from "next/server";

import { sessionRegistry } from "@/lib/auth/session-registry";
import { HOST_SESSION_PREFIX, yorkieTokenRegistry } from "@/lib/auth/yorkie-token";

/** Yorkie's auth webhook (`docs/design/api.md` §2) — what closes the hole that
 *  left port 8080 open to the LAN. A refusal's `reason` reaches the client, so
 *  the two below are worded for that reader: "expired" means fetch another,
 *  "revoked" means another will not help. */
export async function POST(request: NextRequest) {
  let body: { token?: unknown };
  try {
    body = await request.json();
  } catch {
    return deny("malformed webhook request");
  }

  const token = typeof body.token === "string" ? body.token : undefined;

  // Yorkie sends `token: ""` for a client with no injector — the case this exists to stop.
  const sessionId = yorkieTokenRegistry.resolve(token);
  if (!sessionId) {
    return deny("token expired");
  }

  // The prefix skips a `sessionRegistry` lookup that can only fail. Nothing is
  // re-checked: the token route matched the bootstrap secret before issuing, and
  // a restart clears the secret and the registry together.
  if (sessionId.startsWith(HOST_SESSION_PREFIX)) {
    return allow();
  }

  // A live token is not a live session: a device displaced by another
  // (FR-020-08) keeps a valid token, and this is where it stops counting.
  if (!sessionRegistry.resolve(sessionId)) {
    return deny("session revoked");
  }

  return allow();
}

const allow = () => NextResponse.json({ allowed: true, reason: "" });

/** **401, not 200** — why, and why not 403: `docs/design/api.md` §2. */
const deny = (reason: string) =>
  NextResponse.json({ allowed: false, reason }, { status: 401 });
