import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { StoredMember } from "./types.ts";

export const DEFAULT_MEMBERS_PATH = path.resolve(".data/members.json");

/**
 * The workspace's members on disk, so a nickname keeps its id and colour tag
 * across a restart (FR-020-08).
 *
 * Sessions are deliberately not here — a session id in a file is a permanent
 * bearer token, and restarting the container is the revoke path (`api.md`).
 *
 * simple: synchronous writes. Sync on Node's single thread cannot interleave,
 * so `chat-repository.ts`'s promise queue has nothing to do here. It blocks the
 * loop for one small write per join, at eight people. Make it async — with the
 * queue — if that ever becomes enough members to feel.
 */
export function readMembers(storePath: string): Array<StoredMember> {
  try {
    return JSON.parse(readFileSync(storePath, "utf8"));
  } catch (error) {
    // Only a missing file means "nobody has joined yet". A permission or disk
    // error must not be swallowed into an empty list: the next write would then
    // persist one member and silently destroy everyone already on disk.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export function writeMembers(storePath: string, members: Array<StoredMember>): void {
  mkdirSync(path.dirname(storePath), { recursive: true });
  // Write-then-rename, not a direct write: writeFileSync truncates before it
  // writes, so a crash in that window leaves a half-written store. rename on the
  // same filesystem is atomic — a reader sees the old file or the new one.
  const tempPath = `${storePath}.tmp`;
  writeFileSync(tempPath, JSON.stringify(members, null, 2));
  renameSync(tempPath, storePath);
}
