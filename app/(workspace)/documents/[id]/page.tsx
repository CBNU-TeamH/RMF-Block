import { notFound } from "next/navigation";

import { readDocuments } from "@/lib/documents/documents";

import { DocumentEditor } from "./editor";

/**
 * Opens a document (UC-021 step 5). Inside the `(workspace)` route group, so
 * it inherits the shell and the workspace's single `PresenceProvider`
 * connection — `DocumentEditor` attaches its content document through that
 * same client rather than opening a second one.
 */
export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const document = readDocuments().find((doc) => doc.id === id);

  if (!document) notFound();

  return (
    <div className="flex h-full flex-col gap-3">
      <h1 className="text-[22px] font-bold text-ink">{document.name}</h1>
      <DocumentEditor documentId={document.id} />
    </div>
  );
}
