import { NextResponse, type NextRequest } from "next/server";

import { currentMember } from "@/lib/auth/current-member";
import { chatService } from "@/lib/chat/chat-service";
import { ChatValidationError, type ChatAttachment } from "@/lib/chat/types";
import { fileRepository } from "@/lib/files/file-repository";

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
  const fileId = typeof body?.fileId === "string" ? body.fileId : undefined;

  // The request names a file; the server describes it. A client that could send
  // its own `fileName` and `size` could describe a file as something it is not,
  // and that description is what every other client renders.
  let attachment: ChatAttachment | undefined;
  if (fileId) {
    const file = await fileRepository.find(fileId);
    if (!file) {
      return NextResponse.json(
        { error: "첨부 파일을 찾을 수 없습니다." },
        { status: 400 },
      );
    }

    attachment = {
      fileId: file.id,
      fileName: file.name,
      fileType: file.type,
      size: file.size,
    };
  }

  try {
    // The session decides who sent this; the body is only read for `text` and
    // which file to attach.
    const message = await chatService.send({ sender: member.nickname, text, attachment });
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
