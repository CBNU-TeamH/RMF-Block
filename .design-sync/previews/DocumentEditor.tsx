import { AppShell, DocumentEditor } from "rmf-block";

/** The editor needs a live Yorkie connection to load its blocks; without one
 *  it holds at its opening state with the title in place. Compose the editor's
 *  content from the block views (TextBlockView, DividerBlockView, …) instead. */
export function Opening() {
  return (
    <AppShell pathname="/documents/minutes">
      <div className="flex w-[36rem] flex-col gap-3 bg-paper p-6">
        <DocumentEditor documentId="minutes" name="회의록" />
      </div>
    </AppShell>
  );
}
