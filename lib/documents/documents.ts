import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export const DEFAULT_DOCUMENTS_PATH = path.resolve(".data/documents/documents.json");

/** UC-021's 기본 흐름 refuses an empty name; there is nothing else to validate about one. */
export class DocumentValidationError extends Error {}

/**
 * The catalogue; Yorkie holds the content. Split because Yorkie cannot list
 * documents — `attach` needs a key you already hold, and it never learns a
 * name, owner or created time.
 *
 * `id` doubles as the Yorkie document key, and a Yorkie key may only contain
 * `a-z A-Z 0-9 - . _ ~` — which rules out any `:`-delimited scheme.
 */
export type WorkspaceDocument = {
  id: string;
  name: string;
  /**
   * Who made it — a record, not a permission. FR-022-06 and SIR003 both say
   * occupancy does not block anyone from editing, so `ownerId` would name a
   * right nobody has; UC-021's 생성자 is what this actually is.
   */
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
    // Only a missing file means "no documents yet" — an empty workspace is a
    // normal state, not a failure. Anything else is real and must surface.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  // Newest edit first, matching the artboard's `Modified ↓`.
  return documents.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Synchronous, like `lib/auth/member-repository.ts` and for the same reason:
 * on Node's single thread, a read-modify-write with no `await` in it cannot be
 * interleaved by a second call, so there is nothing for a queue (the shape
 * `lib/chat/chat-repository.ts` needs for its *async* appends) to do here.
 */
export function writeDocuments(
  documents: Array<WorkspaceDocument>,
  storePath: string = DEFAULT_DOCUMENTS_PATH,
): void {
  mkdirSync(path.dirname(storePath), { recursive: true });
  // Write-then-rename: writeFileSync truncates before it writes, so a crash
  // mid-write would otherwise leave a half-written store. rename on the same
  // filesystem is atomic — a reader sees the old file or the new one.
  const tempPath = `${storePath}.tmp`;
  writeFileSync(tempPath, JSON.stringify(documents, null, 2));
  renameSync(tempPath, storePath);
}

/**
 * UC-021's E4a: a name already in use gets a disambiguating suffix rather
 * than being refused — the SRS asks for "겹치지 않는 식별자", not an error.
 */
function uniqueName(name: string, existing: Array<WorkspaceDocument>): string {
  const taken = new Set(existing.map((document) => document.name));
  if (!taken.has(name)) return name;

  let n = 2;
  while (taken.has(`${name} (${n})`)) n += 1;
  return `${name} (${n})`;
}

/**
 * UC-021's 기본 흐름. `id` is a `randomUUID()` rather than derived from the
 * name, because it doubles as the Yorkie key and a name can be renamed
 * (UC-023) while a key cannot.
 *
 * Sub-documents (UC-021 E1a) are not here — nothing models a parent yet.
 */
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
