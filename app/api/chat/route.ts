import { NextResponse, type NextRequest } from "next/server";

import { currentMember } from "@/lib/auth/current-member";
import { chatService } from "@/lib/chat/chat-service";
import { ChatValidationError } from "@/lib/chat/types";

/**
 * Chat history (GET) and send (POST) — FR-060-01/04/05/07, `docs/design/api.md`
 * §5 Version A: POST persists then broadcasts `chat:message` over WebSocket
 * (`server/ws-hub.mts`) so every connected client sees it inside NFR-PER-004's
 * 1s budget. GET is what a reconnecting client calls to backfill everything it
 * missed while disconnected.
 *
 * Both require a workspace session. `chat.md` shipped this module before guest
 * login existed and left `sender` client-supplied, with a note that it "becomes
 * server-derived once this module is wired to it" — login arrived and the wiring
 * did not, so until now anything on the LAN could post as anyone without joining
 * at all.
 */
export async function GET() {
  if (!(await currentMember())) {
    return NextResponse.json({ error: "no workspace session" }, { status: 401 });
  }

  return NextResponse.json(await chatService.list());
}

export async function POST(request: NextRequest) {
  const member = await currentMember();
  if (!member) {
    return NextResponse.json({ error: "no workspace session" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text : undefined;

  try {
    // The session decides who sent this; the body is only read for `text`.
    const message = await chatService.send({ sender: member.nickname, text });
    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    if (error instanceof ChatValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    // Anything else is ours to fix, not the sender's — FR-060-07 still wants the
    // client to learn the send failed, just without leaking internals in the response.
    console.error("POST /api/chat failed", error);
    return NextResponse.json({ error: "failed to send message" }, { status: 500 });
  }
}
