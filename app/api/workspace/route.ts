import { NextResponse, type NextRequest } from "next/server";

import { isHost } from "@/lib/auth/current-member";
import { WorkspaceAlreadyOpenError, WorkspaceConfigError, openWorkspace } from "@/lib/workspace-config";

/** UC-010's setup screen: name and access password, after which guests can
 *  join (FR-010-01~04). Host only (FR-011-07). */
export async function POST(request: NextRequest) {
  if (!(await isHost())) {
    return NextResponse.json({ error: "호스트만 할 수 있습니다." }, { status: 401 });
  }

  let body: { name?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청을 읽을 수 없습니다." }, { status: 400 });
  }

  try {
    openWorkspace(body);
  } catch (error) {
    if (error instanceof WorkspaceAlreadyOpenError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof WorkspaceConfigError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  return new NextResponse(null, { status: 204 });
}
