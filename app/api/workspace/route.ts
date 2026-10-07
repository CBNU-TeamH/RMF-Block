import { NextResponse, type NextRequest } from "next/server";

import { isHost } from "@/lib/auth/current-member";
import { WorkspaceConfigError, openWorkspace } from "@/lib/workspace-config";

/** UC-010's setup screen: name and access password, after which guests can
 *  join (FR-010-01~04). Host only (FR-011-07). */
export async function POST(request: NextRequest) {
  if (!(await isHost())) {
    return NextResponse.json({ error: "호스트만 할 수 있습니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) ?? {};

  let opened: boolean;
  try {
    opened = await openWorkspace(body);
  } catch (error) {
    if (error instanceof WorkspaceConfigError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  // Once open, never again — changing it is `PATCH /api/workspace/password`.
  if (!opened) {
    return NextResponse.json({ error: "이미 열린 워크스페이스입니다." }, { status: 409 });
  }

  return new NextResponse(null, { status: 204 });
}
