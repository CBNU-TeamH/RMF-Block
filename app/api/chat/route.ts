import { NextResponse, type NextRequest } from "next/server";

import { currentMember } from "@/lib/auth/current-member";
import { chatService } from "@/lib/chat/chat-service";
import { ChatValidationError, type ChatAttachment } from "@/lib/chat/types";
import { fileRepository } from "@/lib/files/file-repository";

/** Chat history (GET) and send (POST) — FR-060-01/04/05/07, `docs/design/api.md`
 *  §5 Version A. POST persists then broadcasts over the socket inside
 *  NFR-PER-004's 1s budget; GET is a reconnecting client's backfill.
 *
 *  Both require a workspace session. This module shipped before guest login
 *  existed and left `sender` client-supplied, so until the wiring landed anything
 *  on the LAN could post as anyone (`docs/design/chat.md`). */
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

  // The request names a file; the server describes it (`docs/design/chat.md`).
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
