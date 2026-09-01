import { NextResponse, type NextRequest } from "next/server";

import { currentMember } from "@/lib/auth/current-member";
import { readDocuments } from "@/lib/documents/documents";
import { fileRepository } from "@/lib/files/file-repository";
import { looksLikePdf, readUpload } from "@/lib/files/upload";

/**
 * Uploads a file to embed in a document as a file block (FR-022-13, FR-022-14).
 *
 * Bytes never enter the Yorkie document — the block carries a `fileId` and the
 * display metadata it needs to draw itself, and that is all
 * (`docs/design/document-editing.md` §8~10). So the upload is its own request,
 * and the client puts the id it gets back onto the block it then creates. An
 * upload nobody references is a stray file, which is recoverable; a block
 * pointing at bytes that were never stored is not.
 *
 * **PDFs only, today.** FR-022-14 dispatches five kinds into three block types
 * and this build renders one of them, so accepting the rest would mean storing
 * bytes that no block can display. Refusing early is the honest half of a
 * half-built feature — the image and generic-file legs land with their own
 * renderers.
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
