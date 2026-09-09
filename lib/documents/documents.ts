import { randomUUID } from "node:crypto";

import { childrenOf, subtreeIds, wouldCycle } from "./tree.ts";
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
  /** The document this sits under, or `null` at the root (UC-021 E1a).
   *
   *  Optional on the way in, not on the way out: a catalogue written before
   *  sub-documents existed has no such field, and a missing one is a root. That
   *  is the whole migration — no rewrite, no version. */
  parentId?: string | null;
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

/** UC-021 E4a, and FR-021-03's "동일 위치 내" — a name only has to be unique
 *  among its siblings, so the same 회의록 may sit under two different parents. */
function uniqueName(
  name: string,
  siblings: Array<WorkspaceDocument>,
): string {
  const taken = new Set(siblings.map((document) => document.name));
  if (!taken.has(name)) return name;

  let n = 2;
  while (taken.has(`${name} (${n})`)) n += 1;
  return `${name} (${n})`;
}

/** UC-021 기본 흐름, and E1a when `parentId` is given. The id is random, not
 *  derived from the name, because a name can be renamed (UC-023) and a Yorkie
 *  key cannot. */
export function createDocument(
  rawName: string | undefined,
  createdBy: string,
  storePath: string = DEFAULT_DOCUMENTS_PATH,
  parentId: string | null = null,
): WorkspaceDocument {
  const name = rawName?.trim() ?? "";
  if (!name) {
    throw new DocumentValidationError("문서 이름을 입력해 주세요.");
  }

  const documents = readDocuments(storePath);

  // A parent that is not there is refused rather than quietly ignored: the
  // caller asked for a place, and putting the document somewhere else is a
  // worse answer than saying no.
  if (parentId !== null && !documents.some((document) => document.id === parentId)) {
    throw new DocumentValidationError("상위 문서를 찾을 수 없습니다.");
  }

  const now = new Date().toISOString();

  const document: WorkspaceDocument = {
    id: randomUUID(),
    name: uniqueName(name, childrenOf(documents, parentId)),
    parentId,
    createdBy,
    createdAt: now,
    updatedAt: now,
  };

  writeDocuments([...documents, document], storePath);

  return document;
}

/** Thrown when the catalogue has no document with that id. */
export class DocumentNotFoundError extends Error {
  constructor(id: string) {
    super(`no document with id ${id}`);
  }
}

/**
 * FR-023-01. **Refuses a name already used in the same place**, where create
 * would have suffixed it — FR-023-02 asks for an error and a retry, and that
 * asymmetry is deliberate: a suffix on create is the system helping, the same
 * suffix on a rename would overrule what a person just typed.
 */
export function renameDocument(
  id: string,
  rawName: string,
  storePath: string = DEFAULT_DOCUMENTS_PATH,
): WorkspaceDocument {
  const name = rawName.trim();
  if (!name) throw new DocumentValidationError("문서 이름을 입력해 주세요.");

  const documents = readDocuments(storePath);
  const target = documents.find((document) => document.id === id);
  if (!target) throw new DocumentNotFoundError(id);

  const clash = childrenOf(documents, target.parentId ?? null).some(
    (sibling) => sibling.id !== id && sibling.name === name,
  );
  if (clash) throw new DocumentValidationError("같은 위치에 같은 이름의 문서가 있습니다.");

  return writeOne(documents, id, { name }, storePath);
}

/** FR-023-03. A move into the document's own subtree is refused — see
 *  `wouldCycle` for what that would do to the tree. */
export function moveDocument(
  id: string,
  parentId: string | null,
  storePath: string = DEFAULT_DOCUMENTS_PATH,
): WorkspaceDocument {
  const documents = readDocuments(storePath);
  const target = documents.find((document) => document.id === id);
  if (!target) throw new DocumentNotFoundError(id);

  if (parentId !== null && !documents.some((document) => document.id === parentId)) {
    throw new DocumentValidationError("옮길 위치를 찾을 수 없습니다.");
  }
  if (wouldCycle(documents, id, parentId)) {
    throw new DocumentValidationError("문서를 자기 자신의 하위로 옮길 수 없습니다.");
  }

  // The name has to survive the move, and its new siblings may already hold it.
  const name = uniqueName(
    target.name,
    childrenOf(documents, parentId).filter((sibling) => sibling.id !== id),
  );

  return writeOne(documents, id, { parentId, name }, storePath);
}

/**
 * FR-023-04, and FR-023-06's cascade.
 *
 * The subtree goes in **one** write. A parent-then-children cascade that failed
 * half way would leave children whose parent is gone, and while `treeRows`
 * renders those as roots rather than losing them, a catalogue that says
 * something untrue is worse than one write that either happened or did not.
 *
 * Returns the ids removed, so a caller can tell every client at once.
 */
export function deleteDocument(
  id: string,
  storePath: string = DEFAULT_DOCUMENTS_PATH,
): Array<string> {
  const documents = readDocuments(storePath);
  if (!documents.some((document) => document.id === id)) throw new DocumentNotFoundError(id);

  const removed = new Set(subtreeIds(documents, id));
  writeDocuments(
    documents.filter((document) => !removed.has(document.id)),
    storePath,
  );

  return [...removed];
}

/** One document changed, `updatedAt` refreshed, the rest untouched. */
function writeOne(
  documents: Array<WorkspaceDocument>,
  id: string,
  patch: Partial<WorkspaceDocument>,
  storePath: string,
): WorkspaceDocument {
  const updated = { ...documents.find((d) => d.id === id)!, ...patch, updatedAt: new Date().toISOString() };
  writeDocuments(
    documents.map((document) => (document.id === id ? updated : document)),
    storePath,
  );

  return updated;
}
