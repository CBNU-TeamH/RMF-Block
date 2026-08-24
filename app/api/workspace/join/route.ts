import { NextResponse, type NextRequest } from "next/server";

import { sessionRegistry } from "@/lib/auth/session-registry";
import { JoinValidationError } from "@/lib/auth/types";
import { isWorkspacePassword } from "@/lib/workspace-config";

export const SESSION_COOKIE = "workspace_session";

/**
 * FR-020-02~05. Nickname plus the workspace access password; on a match the
 * guest is admitted and the session lands in an httpOnly cookie, so the token
 * never appears in the address bar during screen sharing (UC-030).
 */
export async function POST(request: NextRequest) {
  let body: { nickname?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "malformed request body" }, { status: 400 });
  }

  const nickname = typeof body.nickname === "string" ? body.nickname : undefined;
  const password = typeof body.password === "string" ? body.password : undefined;

  // FR-020-05: a wrong password is the guest's to retry, and the message stays
  // vague — naming which field was wrong would confirm nicknames to a stranger.
  if (!isWorkspacePassword(password)) {
    return NextResponse.json(
      { error: "The nickname or password is incorrect." },
      { status: 401 },
    );
  }

  let joined;
  try {
    joined = sessionRegistry.join(nickname);
  } catch (error) {
    if (error instanceof JoinValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const response = NextResponse.json({ member: joined.member });

  response.cookies.set(SESSION_COOKIE, joined.sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return response;
}
