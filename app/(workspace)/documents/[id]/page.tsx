import { notFound } from "next/navigation";

import { readDocuments } from "@/lib/documents/documents";

/**
 * Opens a document (UC-021 step 5). Inside the `(workspace)` route group, so
 * it inherits the shell and the workspace's single `PresenceProvider`
 * connection — the block editor milestone
 * (`tasks/active/20260829-block-editor-todo.md` §2) attaches its own document
 * through that same client rather than opening a second one.
 *
 * Content is a placeholder until that milestone: this proves create → list →
 * open → survives a reload, which is milestone 1's whole job.
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
    <div className="flex h-full flex-col gap-1">
      <h1 className="text-[22px] font-bold text-ink">{document.name}</h1>
      <p className="text-sm text-ink-faint">에디터는 다음 마일스톤에서 들어옵니다.</p>
    </div>
  );
}
