import { NextResponse, type NextRequest } from "next/server";

import { currentMember } from "@/lib/auth/current-member";
import { fileRepository } from "@/lib/files/file-repository";
import { readUpload } from "@/lib/files/upload";

/** Uploads a file so a chat message can carry it (FR-060-02) — its own request,
 *  metadata-only in response (`docs/design/api.md` §1). Any type: chat
 *  attachments are not dispatched into typed blocks the way FR-022-14's are. */
export async function POST(request: NextRequest) {
  const member = await currentMember();
  if (!member) {
    return NextResponse.json({ error: "no workspace session" }, { status: 401 });
  }

  const upload = await readUpload(request);
  if (!upload.ok) {
    return NextResponse.json({ error: upload.error }, { status: upload.status });
  }

  const stored = await fileRepository.save(Buffer.from(await upload.file.arrayBuffer()), {
    // Both the uploader's to choose; neither becomes a path or a response
    // header (`lib/files/types.ts`).
    name: upload.file.name || "file",
    type: upload.file.type || "application/octet-stream",
    size: upload.file.size,
    uploadedBy: member.nickname,
    origin: "chat",
  });

  return NextResponse.json(stored, { status: 201 });
}
