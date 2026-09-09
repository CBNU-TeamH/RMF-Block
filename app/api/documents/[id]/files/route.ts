import { NextResponse, type NextRequest } from "next/server";

import { currentMember } from "@/lib/auth/current-member";
import { readDocuments } from "@/lib/documents/documents";
import { fileRepository } from "@/lib/files/file-repository";
import { detectImageType, looksLikePdf, readUpload } from "@/lib/files/upload";

/** Uploads a file to embed as a block (FR-022-13, FR-022-14). Its own request
 *  because bytes never enter the Yorkie document — a stray upload is
 *  recoverable, a block pointing at bytes nobody stored is not. Which block a
 *  file becomes, and why the type is sniffed rather than believed:
 *  `docs/design/api.md` §1. */
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
  // The claimed MIME type is never consulted; the stored type is one this server
  // proved. Why that matters: `docs/design/api.md` §1.
  const type = looksLikePdf(bytes)
    ? "application/pdf"
    : (detectImageType(bytes) ?? "application/octet-stream");

  const stored = await fileRepository.save(bytes, {
    // The name is display and download only — never a path, since the store
    // writes under an id (`lib/files/types.ts`).
    name: upload.file.name || "file",
    type,
    size: upload.file.size,
    uploadedBy: member.nickname,
    origin: "document",
  });

  return NextResponse.json(stored, { status: 201 });
}
