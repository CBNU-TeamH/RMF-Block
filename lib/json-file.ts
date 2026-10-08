import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

/** How every store under `.data/` reads and writes its JSON (`docs/design/chat.md`, "Storage").
 *  Sync on purpose: a read-modify-write with no `await` in it cannot be interleaved by a second
 *  call, so no store needs a write queue. */

/** The parsed file, or `empty` when there is no file yet. Only a missing file means "empty": a
 *  permission or disk error must not come back as `empty`, or the next write would persist one
 *  row and silently destroy everything already on disk. */
export function readJsonFile<T>(filePath: string, empty: T): T {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return empty;
    throw error;
  }
}

/** Write-then-rename: a direct write truncates first, so a crash in that window would leave a
 *  half-written store. A rename on the same filesystem is atomic — a reader sees the old file or
 *  the new one. */
export function writeJsonFile(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  writeFileSync(tempPath, JSON.stringify(value, null, 2));
  renameSync(tempPath, filePath);
}
