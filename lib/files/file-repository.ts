import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  InvalidFileIdError,
  type FileOrigin,
  type NewFile,
  type StoredFile,
} from "./types.ts";

const DEFAULT_ROOT = path.resolve(".data/files");
const INDEX_FILE = "index.json";

/**
 * Bytes on disk, metadata in JSON, under `.data/` like every other piece of
 * app-owned state (ADR-002).
 *
 * ```
 * .data/files/<id>          the bytes
 * .data/files/index.json    the metadata for all of them
 * ```
 *
 * **A file is stored under its id, never under the name it was uploaded with.**
 * That name is chosen by whoever uploaded it, and `../../` is a perfectly valid
 * string to put in one. Ids come from `randomUUID()`, whose output is hex and
 * dashes, so a path built from one cannot leave this directory — the property
 * is structural rather than something a check has to catch.
 */
export class FileRepository {
  // Two concurrent uploads would otherwise both read the index, both write it
  // back, and the second would drop the first — the same read-modify-write race
  // `lib/chat/chat-repository.ts` serializes, for the same reason.
  private queue: Promise<unknown> = Promise.resolve();

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

    await mkdir(this.root, { recursive: true });
    await this.writeAtomically(this.pathOf(stored.id), bytes);

    const result = this.queue.then(() => this.appendToIndex(stored));
    // Keep the shared chain healthy even if this write fails — one bad write
    // must not permanently block every save after it.
    this.queue = result.catch(() => undefined);

    try {
      await result;
    } catch (error) {
      // The bytes landed but the index did not, so nothing can ever find them.
      // Removing them keeps the two in step; failing to remove them is not
      // worth masking the real error with.
      await unlink(this.pathOf(stored.id)).catch(() => undefined);
      throw error;
    }

    return stored;
  }

  async find(id: string): Promise<StoredFile | null> {
    return (await this.list()).find((file) => file.id === id) ?? null;
  }

  /**
   * The bytes, or null when no such file was ever stored.
   *
   * The id is checked against the shape this store issues *before* it is used
   * to build a path. Ids reach here straight from a URL, and a check that
   * happens first is worth more than one that happens after the read.
   */
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
    const files = await this.readIndex();
    const wanted = origin ? files.filter((file) => file.origin === origin) : files;

    return [...wanted].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }

  private pathOf(id: string): string {
    return path.join(this.root, id);
  }

  private async appendToIndex(file: StoredFile): Promise<void> {
    const files = await this.readIndex();
    files.push(file);

    await mkdir(this.root, { recursive: true });
    await this.writeAtomically(
      path.join(this.root, INDEX_FILE),
      Buffer.from(JSON.stringify(files, null, 2)),
    );
  }

  private async readIndex(): Promise<Array<StoredFile>> {
    try {
      return JSON.parse(await readFile(path.join(this.root, INDEX_FILE), "utf8"));
    } catch (error) {
      // Only a missing file means "nothing uploaded yet". A permission or disk
      // error must not become an empty list: the next save would then write an
      // index holding one file and lose every record already on disk.
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  /**
   * Write-then-rename. `writeFile` truncates before writing, so a reader can
   * see a half-written file and a crash in that window leaves a corrupt one.
   * `rename` on the same filesystem is atomic — a reader sees the old complete
   * file or the new one, never something in between.
   */
  private async writeAtomically(target: string, bytes: Buffer): Promise<void> {
    const temporary = `${target}.tmp`;
    await writeFile(temporary, bytes);
    await rename(temporary, target);
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
