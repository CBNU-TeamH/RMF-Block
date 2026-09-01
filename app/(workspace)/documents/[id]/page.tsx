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
    <div className="flex h-full min-h-0 flex-col gap-3">
      <h1 className="text-[22px] font-bold text-ink">{document.name}</h1>
      {/* Keyed by the document it is showing, so opening a different one
       * gets a fresh editor rather than the same instance with the previous
       * document's `blocks` still rendered (and its `failed` still set, which
       * would keep showing that error over a document that opens fine).
       * `document-list.tsx` navigates with `Link`/`router.push`, so without a
       * key React reuses this instance across that navigation and only the
       * prop changes — the case React's own "resetting all state when a prop
       * changes" guidance names a key for. */}
      <DocumentEditor key={document.id} documentId={document.id} />
    </div>
  );
}
