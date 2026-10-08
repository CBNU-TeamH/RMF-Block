import path from "node:path";

import { readJsonFile, writeJsonFile } from "../json-file.ts";
import type { StoredMember } from "./types.ts";

export const DEFAULT_MEMBERS_PATH = path.resolve(".data/members.json");

/** The workspace's members on disk, so a nickname keeps its id and colour tag
 *  across a restart (FR-020-08). Sessions are deliberately not here (`api.md`).
 *
 *  simple: synchronous writes (`architecture.md` §(d)). One small write per join
 *  at eight people; make it async, with the queue, if that ever grows. */
export function readMembers(storePath: string): Array<StoredMember> {
  return readJsonFile(storePath, []);
}

export function writeMembers(storePath: string, members: Array<StoredMember>): void {
  writeJsonFile(storePath, members);
}
