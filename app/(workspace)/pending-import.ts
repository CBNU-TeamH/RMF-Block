/** Markdown waiting for its new document's first attach: `docs/design/app-shell.md`,
 *  "Importing Markdown". */
const pending = new Map<string, string>();

export function holdImport(documentId: string, markdown: string): void {
  pending.set(documentId, markdown);
}

/** The Markdown waiting for `documentId`, once — a second call gets nothing. */
export function takeImport(documentId: string): string | undefined {
  const markdown = pending.get(documentId);
  pending.delete(documentId);
  return markdown;
}
