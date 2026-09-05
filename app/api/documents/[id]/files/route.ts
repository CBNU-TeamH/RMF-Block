import { NextResponse, type NextRequest } from "next/server";

import { currentMember } from "@/lib/auth/current-member";
import { readDocuments } from "@/lib/documents/documents";
import { fileRepository } from "@/lib/files/file-repository";
import { looksLikePdf, readUpload } from "@/lib/files/upload";

/**
 * Uploads a file to embed as a file block (FR-022-13, FR-022-14).
 *
 * Its own request because bytes never enter the Yorkie document; the client
 * puts the returned id on the block it then creates. A stray upload is
 * recoverable, a block pointing at bytes nobody stored is not.
 *
 * **PDFs only today** — the other two legs of FR-022-14 have no renderer, and
 * storing bytes no block can display is worse than a refusal.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const member = await currentMember();
  if (!member) {
    return NextResponse.json({ error: "no workspace session" }, { status: 401 });
  }

  // The document has to exist before its bytes do. Nothing downstream needs the
  // id — the store is workspace-wide and a file finds its way back through the
  // block that names it — but an upload against a document that was deleted (or
  // never existed) is a mistake worth reporting rather than a file nobody can
  // ever reach.
  const { id } = await params;
  if (!readDocuments().some((document) => document.id === id)) {
    return NextResponse.json({ error: "no such document" }, { status: 404 });
  }

  const upload = await readUpload(request);
  if (!upload.ok) {
    return NextResponse.json({ error: upload.error }, { status: upload.status });
  }

  const bytes = Buffer.from(await upload.file.arrayBuffer());
  // The uploader's claimed MIME type is not consulted: it is a string they
  // choose, and what decides whether this is a PDF is the file itself.
  if (!looksLikePdf(bytes)) {
    return NextResponse.json(
      { error: "지금은 PDF 파일만 문서에 넣을 수 있습니다." },
      { status: 415 },
    );
  }

  const stored = await fileRepository.save(bytes, {
    // The name is display and download only — never a path, since the store
    // writes under an id (`lib/files/types.ts`).
    name: upload.file.name || "file.pdf",
    // Stored as what the bytes proved to be, not as what the request claimed.
    // `preview` reads this to decide it may answer inline, so the one endpoint
    // that names a content type now names one this server verified.
    type: "application/pdf",
    size: upload.file.size,
    uploadedBy: member.nickname,
    origin: "document",
  });

  return NextResponse.json(stored, { status: 201 });
}
