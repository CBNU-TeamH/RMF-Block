import { NextResponse, type NextRequest } from "next/server";

import { isHost } from "@/lib/auth/current-member";
import { WorkspaceConfigError, changeWorkspacePassword } from "@/lib/workspace-config";

/** UC-011 E1: a new password for the next join. Connected users keep their
 *  sessions — nothing here touches the session registry (FR-011-04~06). */
export async function PATCH(request: NextRequest) {
  if (!(await isHost())) {
    return NextResponse.json({ error: "호스트만 할 수 있습니다." }, { status: 401 });
  }

  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청을 읽을 수 없습니다." }, { status: 400 });
  }

  try {
    changeWorkspacePassword(body.password);
  } catch (error) {
    if (error instanceof WorkspaceConfigError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  return new NextResponse(null, { status: 204 });
}
