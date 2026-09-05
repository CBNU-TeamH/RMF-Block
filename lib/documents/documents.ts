import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export const DEFAULT_DOCUMENTS_PATH = path.resolve(".data/documents/documents.json");

/** UC-021's 기본 흐름 refuses an empty name; there is nothing else to validate about one. */
export class DocumentValidationError extends Error {}

/** The catalogue; Yorkie holds the content. Why it is separate:
 *  `docs/design/architecture.md` §(d). `id` doubles as the Yorkie key, so it is
 *  limited to `a-z A-Z 0-9 - . _ ~` — no `:`-delimited scheme. */
export type WorkspaceDocument = {
  id: string;
  name: string;
  /** A record, not a permission (FR-022-06, SIR003) — UC-021's 생성자. */
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export function readDocuments(
  storePath: string = DEFAULT_DOCUMENTS_PATH,
): Array<WorkspaceDocument> {
  let documents: Array<WorkspaceDocument>;
  try {
    documents = JSON.parse(readFileSync(storePath, "utf8"));
  } catch (error) {
    // A missing file is an empty workspace, not a failure; anything else is real.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  // Newest edit first, matching the artboard's `Modified ↓`.
  return documents.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Sync on purpose — why that removes the need for a write queue:
 *  `docs/design/architecture.md` §(d). */
export function writeDocuments(
  documents: Array<WorkspaceDocument>,
  storePath: string = DEFAULT_DOCUMENTS_PATH,
): void {
  mkdirSync(path.dirname(storePath), { recursive: true });
  // Write-then-rename, for the atomicity argued in architecture.md §(d).
  const tempPath = `${storePath}.tmp`;
  writeFileSync(tempPath, JSON.stringify(documents, null, 2));
  renameSync(tempPath, storePath);
}

/** UC-021 E4a. */
function uniqueName(name: string, existing: Array<WorkspaceDocument>): string {
  const taken = new Set(existing.map((document) => document.name));
  if (!taken.has(name)) return name;

  let n = 2;
  while (taken.has(`${name} (${n})`)) n += 1;
  return `${name} (${n})`;
}

/** UC-021 기본 흐름. The id is random, not derived from the name, because a
 *  name can be renamed (UC-023) and a Yorkie key cannot. Sub-documents (E1a)
 *  await a parent model. */
export function createDocument(
  rawName: string | undefined,
  createdBy: string,
  storePath: string = DEFAULT_DOCUMENTS_PATH,
): WorkspaceDocument {
  const name = rawName?.trim() ?? "";
  if (!name) {
    throw new DocumentValidationError("문서 이름을 입력해 주세요.");
  }

  const documents = readDocuments(storePath);
  const now = new Date().toISOString();

  const document: WorkspaceDocument = {
    id: randomUUID(),
    name: uniqueName(name, documents),
    createdBy,
    createdAt: now,
    updatedAt: now,
  };

  writeDocuments([...documents, document], storePath);

  return document;
}
