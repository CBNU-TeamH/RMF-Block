import { sessionRegistry } from "@/lib/auth/session-registry";
import { readDocuments } from "@/lib/documents/documents";

import { DocumentList, type DocumentRow } from "./document-list";

/**
 * The workspace home (`dashboard.dc.html` screen 2). A server component: it
 * reads the document catalogue off disk and hands the rows down, so the list is
 * already in the HTML when the page arrives and there is no endpoint for a
 * browser to call. The shell around it is `layout.tsx`.
 *
 * Documents are fixtures for now — nothing creates them until FR-021 lands with
 * the block editor. What this proves is the read path: one file the server
 * owns, the same list on the host's screen and on a guest's second device.
 */
export default async function WorkspaceHome() {
  const documents = readDocuments();
  // Resolved here rather than stored on the document: a nickname or colour can
  // change, and a member can be removed, so the join has to happen at read time.
  const membersById = new Map(sessionRegistry.members().map((m) => [m.id, m]));

  const rows: Array<DocumentRow> = documents.map((doc) => ({
    ...doc,
    owner: membersById.get(doc.ownerId) ?? null,
  }));

  return <DocumentList documents={rows} />;
}
