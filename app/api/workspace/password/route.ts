import { NextResponse, type NextRequest } from "next/server";

import { isHost } from "@/lib/auth/current-member";
import { WorkspaceConfigError, changeWorkspacePassword } from "@/lib/workspace-config";

/** UC-011 E1: a new password for the next join. Connected users keep their
 *  sessions — nothing here touches the session registry (FR-011-04~06). */
export async function PATCH(request: NextRequest) {
  if (!(await isHost())) {
    return NextResponse.json({ error: "호스트만 할 수 있습니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) ?? {};

  let changed: boolean;
  try {
    changed = await changeWorkspacePassword(body.password);
  } catch (error) {
    if (error instanceof WorkspaceConfigError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  // Before setup there is nothing to change — setup is `POST /api/workspace`.
  if (!changed) {
    return NextResponse.json({ error: "워크스페이스가 아직 열리지 않았습니다." }, { status: 409 });
  }

  return new NextResponse(null, { status: 204 });
}
