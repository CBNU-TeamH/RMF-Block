import { zipSync } from "fflate";
import { NextResponse, type NextRequest } from "next/server";

import { readRootBlocks } from "@/lib/blocks/revision-snapshot";
import { currentMember } from "@/lib/auth/current-member";
import { readDocuments } from "@/lib/documents/documents";
import { embeddedFileIds, planExport } from "@/lib/documents/export";
import { subtreeIds } from "@/lib/documents/tree";
import { fileRepository } from "@/lib/files/file-repository";
import { attachmentHeaders } from "@/lib/files/serving";
import { InvalidFileIdError } from "@/lib/files/types";
import { readDocumentRoots, yorkieAdminAddr } from "@/lib/yorkie-admin";

/** A document as Markdown (FR-022-15/16): one `.md`, or a zip with its files and,
 *  with `?subpages=1`, its sub-pages. Built here rather than in the browser,
 *  and laid out by `planExport`: `docs/design/document-export.md`. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await currentMember())) {
    return NextResponse.json({ error: "no workspace session" }, { status: 401 });
  }

  const { id } = await params;
  const documents = readDocuments();
  if (!documents.some((document) => document.id === id)) {
    return NextResponse.json({ error: "no such document" }, { status: 404 });
  }

  const ids = request.nextUrl.searchParams.get("subpages") === "1" ? subtreeIds(documents, id) : [id];
  let roots: Map<string, string>;
  try {
    roots = await readDocumentRoots(yorkieAdminAddr(), ids);
  } catch (error) {
    console.error(`  ✗ Could not read the documents from Yorkie: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json({ error: "문서 내용을 읽지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }
  // A document nobody has opened has no root yet: it exports empty.
  const blocks = new Map(ids.map((documentId) => [documentId, readRootBlocks(roots.get(documentId) ?? "{}")]));

  // Only files the store still lists — a trashed document's are hidden from it.
  const listed = new Set((await fileRepository.list()).map((file) => file.id));
  const wanted = [...embeddedFileIds(blocks)].filter((fileId) => listed.has(fileId));
  // A missing file (`null`) or an id the store could not have issued is left out
  // of the export; any other read failure fails it, rather than sending a zip
  // that is quietly short of a file.
  const read = await Promise.all(
    wanted.map((fileId) =>
      fileRepository.read(fileId).catch((error: unknown) => {
        if (error instanceof InvalidFileIdError) return null;
        throw error;
      }),
    ),
  );
  const bytes = new Map(wanted.flatMap((fileId, index) => (read[index] ? [[fileId, read[index]] as const] : [])));

  const plan = planExport({
    documents,
    ids,
    blocks,
    hasFile: (fileId) => bytes.has(fileId),
    // The address the browser used: in the custom server `request.url` is built
    // from HOSTNAME (`app/api/auth/host/route.ts`), not what a guest can reach.
    origin: `http://${request.headers.get("host") ?? new URL(request.url).host}`,
  });

  const headers = attachmentHeaders(plan.fileName);
  // An export is read fresh every time; `attachmentHeaders` caches an upload, which never changes.
  headers.set("Cache-Control", "no-store");
  if (plan.kind === "markdown") {
    headers.set("Content-Type", "text/markdown; charset=utf-8");
    return new Response(plan.text, { headers });
  }

  const encoder = new TextEncoder();
  // Files are stored, not deflated: images and PDFs are compressed already, and
  // deflating them would hold this process — and its sockets — for nothing.
  const zip = zipSync(
    Object.fromEntries(
      plan.entries.map((entry) => [entry.path, "text" in entry ? encoder.encode(entry.text) : [bytes.get(entry.fileId)!, { level: 0 }]]),
    ),
  );
  headers.set("Content-Type", "application/zip");
  return new Response(zip, { headers });
}
