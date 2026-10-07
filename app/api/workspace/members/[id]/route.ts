import { NextResponse } from "next/server";

import { isHost } from "@/lib/auth/current-member";
import { sessionRegistry } from "@/lib/auth/session-registry";
import { wsHub } from "@/server/ws-hub.mts";

/** UC-011's kick (FR-011-01/03/07). The socket is told why before it closes,
 *  and Yorkie stops honouring the guest's token within the auth webhook's cache
 *  TTL (`docker-compose.yml`), since the webhook resolves the session again. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isHost())) {
    return NextResponse.json({ error: "호스트만 할 수 있습니다." }, { status: 401 });
  }

  const { id } = await params;
  const sessionId = sessionRegistry.kick(id);
  if (!sessionId) {
    return NextResponse.json({ error: "접속 중인 게스트가 아닙니다." }, { status: 404 });
  }

  wsHub.revoke(sessionId, "kicked");
  return new NextResponse(null, { status: 204 });
}
