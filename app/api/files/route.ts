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
  const [roots, files, messages] = await Promise.all([
    readDocumentRoots(yorkieAdminAddr(), documents.map((document) => document.id)).catch((error: unknown) => {
      // Chat files still list; the page says the document side could not be read.
      console.error(`  ✗ Could not read the documents from Yorkie: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }),
    fileRepository.list("document"),
    chatService.list(),
  ]);

  return NextResponse.json({
    files: workspaceFiles({ documents, roots, files, messages }),
    documentsUnavailable: roots === null,
  });
}
