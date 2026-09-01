import { NextResponse, type NextRequest } from "next/server";

import { currentMember } from "@/lib/auth/current-member";
import { fileRepository } from "@/lib/files/file-repository";

/**
 * Uploads a file so a chat message can carry it (FR-060-02).
 *
 * Bytes are their own request rather than part of `POST /api/chat`, because
 * bytes cannot ride a CRDT — `docs/design/api.md` §1 marks this path as one of
 * the two that survive a move to chat version B for exactly that reason.
 *
 * The response is metadata only. The client puts the `fileId` on the message it
 * then sends, so an upload that is never referenced is a stray file rather than
 * a half-sent message.
 */

/**
 * 25 MB. Nothing in the SRS names a number; this one is chosen to be larger
 * than the screenshots and documents this is for and small enough that the
 * whole thing sitting in memory during the parse is not a problem for a
 * workspace SRS §2.4 sizes at eight people.
 */
const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const member = await currentMember();
  if (!member) {
    return NextResponse.json({ error: "no workspace session" }, { status: 401 });
  }

  // Both checks happen before parsing, because `formData()` reads the entire
  // body into memory first — once it resolves, refusing is too late to have
  // saved anything.
  //
  // A declared length is required, not merely inspected. Without one the
  // request is chunked, nothing bounds it, and the body is fully buffered
  // before `file.size` below can object — so an oversized upload costs the
  // memory whether or not it is ultimately refused. With one, Node reads
  // exactly that many bytes as the body, so this check bounds what parsing can
  // cost. It excludes no real client: `fetch` computes the length for a
  // `FormData` body.
  const declared = Number(request.headers.get("content-length"));
  if (!Number.isFinite(declared) || declared <= 0) {
    return NextResponse.json(
      { error: "업로드 크기를 알 수 없습니다." },
      { status: 411 },
    );
  }
  // The length is still only the uploader's claim about the whole body, so the
  // file's own size is checked again after parsing.
  if (declared > MAX_BYTES) {
    return tooLarge();
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "업로드를 읽을 수 없습니다." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "첨부할 파일이 없습니다." },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return tooLarge();
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "빈 파일입니다." }, { status: 400 });
  }

  const stored = await fileRepository.save(Buffer.from(await file.arrayBuffer()), {
    // `file.name` and `file.type` are both the uploader's to choose. The name is
    // display and download only — never a path, since the store writes under an
    // id — and the type is never echoed into a response header. See
    // `lib/files/types.ts`.
    name: file.name || "file",
    type: file.type || "application/octet-stream",
    size: file.size,
    uploadedBy: member.nickname,
    origin: "chat",
  });

  return NextResponse.json(stored, { status: 201 });
}

/** 413, and a message the sender can act on rather than a generic failure. */
function tooLarge() {
  return NextResponse.json(
    { error: `파일은 ${MAX_BYTES / 1024 / 1024}MB 이하만 첨부할 수 있습니다.` },
    { status: 413 },
  );
}
