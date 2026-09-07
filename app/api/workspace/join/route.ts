import { NextResponse, type NextRequest } from "next/server";

import { sessionRegistry } from "@/lib/auth/session-registry";
import {
  SESSION_COOKIE,
  JoinValidationError,
  MemberStoreError,
  WorkspaceFullError,
} from "@/lib/auth/types";
import { isWorkspacePassword } from "@/lib/workspace-config";
import { wsHub } from "@/server/ws-hub.mts";

/** FR-020-02~05/08. Nickname plus the workspace password; the session lands in
 *  an httpOnly cookie, so it never appears in the address bar during screen
 *  sharing (UC-030). What this answers with: `docs/design/api.md`. */
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

  // FR-020-05: the message names the password because that is the only thing
  // this branch can mean (`docs/design/api.md`).
  if (!isWorkspacePassword(password)) {
    return NextResponse.json({ error: "비밀번호가 틀렸습니다." }, { status: 401 });
  }

  // 409 rather than a silent takeover, and after the password check, never
  // before (`docs/design/api.md`).
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
    if (error instanceof MemberStoreError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    // A body the form can render — re-throwing gave Next's 500 page, and the
    // form then blamed the network (`docs/design/api.md`).
    console.error("join failed", error);
    return NextResponse.json(
      { error: "입장하지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
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
