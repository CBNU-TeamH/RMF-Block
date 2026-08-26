import { NextResponse, type NextRequest } from "next/server";

import { sessionRegistry } from "@/lib/auth/session-registry";
import {
  SESSION_COOKIE,
  JoinValidationError,
  WorkspaceFullError,
} from "@/lib/auth/types";
import { isWorkspacePassword } from "@/lib/workspace-config";
import { wsHub } from "@/server/ws-hub.mts";

/**
 * FR-020-02~05/08. Nickname plus the workspace access password; on a match the
 * guest is admitted and the session lands in an httpOnly cookie, so the token
 * never appears in the address bar during screen sharing (UC-030).
 *
 * A nickname someone is still signed in under comes back as 409 rather than
 * silently displacing them; the client asks and retries with `force: true`.
 */
export async function POST(request: NextRequest) {
  let body: { nickname?: unknown; password?: unknown; force?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청을 읽을 수 없습니다." }, { status: 400 });
  }

  const nickname = typeof body.nickname === "string" ? body.nickname : undefined;
  const password = typeof body.password === "string" ? body.password : undefined;
  // Set by the client only after the guest has seen the takeover warning below.
  const force = body.force === true;

  // FR-020-05: a wrong password is the guest's to retry. The message names the
  // password because that is the only thing this branch can mean — an unknown
  // nickname is not a failure here, it becomes a new member — so the older
  // "nickname or password" wording pointed at a field that cannot be at fault.
  if (!isWorkspacePassword(password)) {
    return NextResponse.json({ error: "비밀번호가 틀렸습니다." }, { status: 401 });
  }

  // FR-020-08 takes the nickname over and revokes the other device. Right for
  // one person's second device, wrong for two people who picked the same name
  // during the opening rush — and the server cannot tell those apart, since a
  // nickname plus a password everyone shares is all it has. So it asks.
  //
  // After the password check, never before: this is the one response that
  // confirms a nickname is in use, and only someone already inside sees it.
  if (!force && sessionRegistry.hasLiveSession(nickname)) {
    return NextResponse.json({ reason: "nickname-live" }, { status: 409 });
  }

  let joined;
  try {
    joined = sessionRegistry.join(nickname);
  } catch (error) {
    if (error instanceof JoinValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof WorkspaceFullError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }

  // FR-020-08: the previous device stops being the live one, so tell it before
  // it goes on rendering a workspace it is no longer in.
  if (joined.revokedSessionId) {
    wsHub.revoke(joined.revokedSessionId);
  }

  const response = NextResponse.json({ member: joined.member });

  response.cookies.set(SESSION_COOKIE, joined.sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return response;
}
