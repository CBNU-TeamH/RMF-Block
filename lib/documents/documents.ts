import { randomUUID } from "node:crypto";

import path from "node:path";

import { readJsonFile, writeJsonFile } from "../json-file.ts";
import { childrenOf, subtreeIds, wouldCycle } from "./tree.ts";

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
  // Newest edit first, matching the artboard's `Modified ↓`.
  return readJsonFile<Array<WorkspaceDocument>>(storePath, []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Sync on purpose — why that removes the need for a write queue:
 *  `docs/design/architecture.md` §(d). */
export function writeDocuments(
  documents: Array<WorkspaceDocument>,
  storePath: string = DEFAULT_DOCUMENTS_PATH,
): void {
  writeJsonFile(storePath, documents);
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

/** One delete, as the host's trash holds it: the document and its subtree,
 *  parent first, exactly as they were. */
export type TrashEntry = { deletedAt: string; documents: Array<WorkspaceDocument> };

/** How long a deleted document can still be restored. */
export const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Next to the catalogue, so a test's scratch catalogue gets a scratch trash. */
const trashPathOf = (storePath: string) => path.join(path.dirname(storePath), "deleted.json");

/**
 * FR-023-04, and FR-023-06's cascade. A soft delete: the subtree leaves the
 * catalogue — every guest sees it gone — and goes to the trash as one entry,
 * so the host can restore it (`restoreDocument`) and its ids, which are its
 * Yorkie keys, stay known (`docs/design/version-history.md`, "Deleting a document").
 *
 * The catalogue changes in **one** write. A parent-then-children cascade that
 * failed half way would leave children whose parent is gone, and while
 * `treeRows` renders those as roots rather than losing them, a catalogue that
 * says something untrue is worse than one write that either happened or did not.
 * The trash is written first: a crash between the two leaves a document in both,
 * never in neither.
 *
 * Returns the ids removed, so a caller can tell every client at once.
 */
export function deleteDocument(
  id: string,
  storePath: string = DEFAULT_DOCUMENTS_PATH,
): Array<string> {
  const documents = readDocuments(storePath);
  if (!documents.some((document) => document.id === id)) throw new DocumentNotFoundError(id);

  const ids = subtreeIds(documents, id);
  const removed = ids.map((removedId) => documents.find((document) => document.id === removedId)!);
  const trashPath = trashPathOf(storePath);
  writeJsonFile(trashPath, [
    ...readJsonFile<Array<TrashEntry>>(trashPath, []),
    { deletedAt: new Date().toISOString(), documents: removed },
  ]);
  writeDocuments(
    documents.filter((document) => !ids.includes(document.id)),
    storePath,
  );

  return ids;
}

/** The host's trash, newest delete first. */
export function readTrash(storePath: string = DEFAULT_DOCUMENTS_PATH): Array<TrashEntry> {
  return readJsonFile<Array<TrashEntry>>(trashPathOf(storePath), []).sort((a, b) =>
    b.deletedAt.localeCompare(a.deletedAt),
  );
}

/**
 * Puts a trash entry back, subtree and all, and returns its documents parent
 * first — the order a client's tree can apply them in. The root goes back
 * where it was if that parent is still in the catalogue, at the top level if
 * not; and gets a suffix if a sibling took its name meanwhile, as on create.
 */
export function restoreDocument(
  rootId: string,
  storePath: string = DEFAULT_DOCUMENTS_PATH,
): Array<WorkspaceDocument> {
  const trashPath = trashPathOf(storePath);
  const trash = readJsonFile<Array<TrashEntry>>(trashPath, []);
  const entry = trash.find((candidate) => candidate.documents[0]?.id === rootId);
  if (!entry) throw new DocumentNotFoundError(rootId);

  const documents = readDocuments(storePath);
  const [root, ...descendants] = entry.documents;
  const parentId = documents.some((document) => document.id === root!.parentId)
    ? root!.parentId!
    : null;
  const restored = [
    { ...root!, parentId, name: uniqueName(root!.name, childrenOf(documents, parentId)) },
    ...descendants,
  ];

  // Catalogue first, for the same reason the delete writes the trash first.
  writeDocuments([...documents, ...restored], storePath);
  writeJsonFile(trashPath, trash.filter((candidate) => candidate !== entry));

  return restored;
}

/** Drops every trash entry older than `TRASH_TTL_MS` and returns the ids it
 *  held, so the caller can purge their files. No timer runs this: whoever reads
 *  or adds to the trash calls it first. */
export function purgeExpiredTrash(
  storePath: string = DEFAULT_DOCUMENTS_PATH,
  now: number = Date.now(),
): Array<string> {
  const trashPath = trashPathOf(storePath);
  const trash = readJsonFile<Array<TrashEntry>>(trashPath, []);
  const expired = trash.filter((entry) => now - Date.parse(entry.deletedAt) >= TRASH_TTL_MS);
  if (expired.length === 0) return [];

  writeJsonFile(trashPath, trash.filter((entry) => !expired.includes(entry)));
  return expired.flatMap((entry) => entry.documents.map((document) => document.id));
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
