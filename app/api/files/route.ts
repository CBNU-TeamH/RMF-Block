import { NextResponse } from "next/server";

import { currentMember } from "@/lib/auth/current-member";
import { chatService } from "@/lib/chat/chat-service";
import { readDocuments } from "@/lib/documents/documents";
import { fileRepository } from "@/lib/files/file-repository";
import { workspaceFiles } from "@/lib/files/workspace-files";
import { readDocumentRoots, yorkieAdminAddr } from "@/lib/yorkie-admin";

/** The workspace file list (UC-050, FR-050-01/02/06). Which block holds a
 *  document file is read from Yorkie on every request rather than recorded at
 *  upload — `docs/design/file-manager.md`. */
export async function GET() {
  if (!(await currentMember())) {
    return NextResponse.json({ error: "no workspace session" }, { status: 401 });
  }

  const documents = readDocuments();
  let roots: Map<string, string> | null = null;
  try {
    roots = await readDocumentRoots(yorkieAdminAddr(), documents.map((document) => document.id));
  } catch (error) {
    // Chat files still list; the page says the document side could not be read.
    console.error(`  ✗ Could not read the documents from Yorkie: ${error instanceof Error ? error.message : String(error)}`);
  }

  const files = workspaceFiles({
    documents,
    roots,
    files: await fileRepository.list("document"),
    messages: await chatService.list(),
  });
  return NextResponse.json({ files, documentsUnavailable: roots === null });
}
