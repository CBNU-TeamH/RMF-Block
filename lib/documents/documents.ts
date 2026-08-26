import { readFileSync } from "node:fs";
import path from "node:path";

export const DEFAULT_DOCUMENTS_PATH = path.resolve(".data/documents/documents.json");

/**
 * A document as the workspace knows it. Yorkie holds the *content*; this is the
 * catalogue, and the two are split because Yorkie has no way to list documents —
 * its client exposes `attach`, which needs a key you already hold, and it never
 * learns a document's name, owner or created time.
 *
 * `id` is also the Yorkie document key, with no prefix: a Yorkie key may only
 * contain `a-z A-Z 0-9 - . _ ~`, which rules out a `:`-delimited scheme
 * (`docs/design/api.md` §2).
 */
export type WorkspaceDocument = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Read-only on purpose. Nothing creates a document yet — the fixtures in
 * `.data/documents/documents.json` are written by hand — so there is no write
 * path to serialize against and none of `lib/chat/chat-repository.ts`'s queue
 * applies. Creating documents is FR-021, and it arrives with the block editor
 * that gives a document somewhere to go.
 */
export function readDocuments(
  storePath: string = DEFAULT_DOCUMENTS_PATH,
): Array<WorkspaceDocument> {
  let documents: Array<WorkspaceDocument>;
  try {
    documents = JSON.parse(readFileSync(storePath, "utf8"));
  } catch (error) {
    // Only a missing file means "no documents yet" — an empty workspace is a
    // normal state, not a failure. Anything else is real and must surface.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  // Newest edit first, matching the artboard's `Modified ↓`.
  return documents.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
