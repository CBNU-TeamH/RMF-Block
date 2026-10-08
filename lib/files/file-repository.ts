import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { readDocuments } from "../documents/documents.ts";
import { readJsonFile, writeJsonFile } from "../json-file.ts";
import {
  InvalidFileIdError,
  type FileOrigin,
  type NewFile,
  type StoredFile,
} from "./types.ts";

const DEFAULT_ROOT = path.resolve(".data/files");
const INDEX_FILE = "index.json";

/** Bytes at `.data/files/<id>`, metadata in `.data/files/index.json`, under
 *  `.data/` like every other piece of app-owned state (ADR-002). **Stored under
 *  the id, never the uploaded name** — `../../` is a valid name, and a
 *  `randomUUID()` path structurally cannot leave this directory.
 *
 *  Every index change is a synchronous read-modify-write, so two concurrent
 *  uploads cannot drop each other's record — why no queue: `docs/design/chat.md`,
 *  "Storage". */
export class FileRepository {
  private readonly root: string;
  private readonly liveDocumentIds: () => Set<string>;

  // `liveDocumentIds` is injectable for the same reason `root` is: tests point
  // it somewhere other than the real `.data/`.
  constructor(
    root: string = DEFAULT_ROOT,
    liveDocumentIds: () => Set<string> = () => new Set(readDocuments().map((document) => document.id)),
  ) {
    this.root = root;
    this.liveDocumentIds = liveDocumentIds;
  }

  /** Writes the bytes and records the metadata. */
  async save(bytes: Buffer, file: NewFile): Promise<StoredFile> {
    const stored: StoredFile = {
      ...file,
      id: randomUUID(),
      uploadedAt: new Date().toISOString(),
    };

    // The bytes are not a read-modify-write, so they stay async: up to 25MB
    // should not stall every socket this process serves.
    await mkdir(this.root, { recursive: true });
    const target = this.pathOf(stored.id);
    await writeFile(`${target}.tmp`, bytes);
    await rename(`${target}.tmp`, target);

    try {
      this.writeIndex([...this.readIndex(), stored]);
    } catch (error) {
      // The bytes landed but the index did not, so nothing can ever find them.
      // Removing them keeps the two in step; failing to remove them is not
      // worth masking the real error with.
      await unlink(target).catch(() => undefined);
      throw error;
    }

    return stored;
  }

  async find(id: string): Promise<StoredFile | null> {
    return (await this.list()).find((file) => file.id === id) ?? null;
  }

  /** The bytes, or null. The id is checked against the shape this store issues
   *  **before** it builds a path — ids reach here straight from a URL. */
  async read(id: string): Promise<Buffer | null> {
    assertIssuableId(id);

    try {
      return await readFile(this.pathOf(id));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  /** Every file still in use, newest first, optionally narrowed to one origin.
   *  A document's file shows only while its document is in the catalogue — in
   *  the trash, it is hidden, and a restore shows it again. Worked out here
   *  rather than stored on the file, so no second write can fall out of step.
   *  `find()` goes through here, so download and preview follow. */
  async list(origin?: FileOrigin): Promise<Array<StoredFile>> {
    const live = this.liveDocumentIds();
    const files = this.readIndex().filter(
      (file) =>
        (!file.documentId || live.has(file.documentId)) && (!origin || file.origin === origin),
    );

    return files.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }

  /** Deletes the files of these documents for good — record first, then bytes.
   *  A byte file that fails to go is space, not data: nothing can reach it once
   *  its record is gone, so the failure is not worth failing the caller for. */
  async purge(documentIds: Array<string>): Promise<void> {
    const ids = new Set(documentIds);
    const files = this.readIndex();
    const gone = files.filter((file) => file.documentId && ids.has(file.documentId));
    if (gone.length === 0) return;

    this.writeIndex(files.filter((file) => !gone.includes(file)));
    await Promise.all(gone.map((file) => unlink(this.pathOf(file.id)).catch(() => undefined)));
  }

  private pathOf(id: string): string {
    return path.join(this.root, id);
  }

  private readIndex(): Array<StoredFile> {
    return readJsonFile(path.join(this.root, INDEX_FILE), []);
  }

  private writeIndex(files: Array<StoredFile>): void {
    writeJsonFile(path.join(this.root, INDEX_FILE), files);
  }
}

/** `randomUUID()`'s output, and nothing else. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function assertIssuableId(id: string): void {
  if (!UUID.test(id)) {
    throw new InvalidFileIdError(`${id} is not an id this store issues`);
  }
}

export const fileRepository = new FileRepository();
