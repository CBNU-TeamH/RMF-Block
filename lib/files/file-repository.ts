import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

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

  constructor(root: string = DEFAULT_ROOT) {
    this.root = root;
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

  /** Every file, newest first, optionally narrowed to one origin. */
  async list(origin?: FileOrigin): Promise<Array<StoredFile>> {
    const files = this.readIndex();
    const wanted = origin ? files.filter((file) => file.origin === origin) : files;

    return [...wanted].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
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
