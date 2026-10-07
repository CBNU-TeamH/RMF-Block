import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

/** The workspace name and access password (FR-010-01/02), set by the host on
 *  the setup screen and kept in `.data/` so a restart resumes the same
 *  workspace (FR-010-05, NFR-REL-002). Chosen by a person and told to guests out
 *  of band, so the server never rejects it for being simple — `1234` is
 *  legitimate for an hour on a LAN. The one rule is a length floor, to catch a
 *  typo rather than to enforce strength. */
const MIN_PASSWORD_LENGTH = 4;
const MAX_NAME_LENGTH = 40;

const DEFAULT_WORKSPACE_NAME = "RMF Block";

export const DEFAULT_WORKSPACE_PATH = path.resolve(".data/workspace.json");

/** Hashed, never the password itself: `.data/` sits on the host's disk and in
 *  backups of the volume. */
type StoredWorkspace = { name: string; salt: string; passwordHash: string };

/** Input the host controls — a route maps it to 400. */
export class WorkspaceConfigError extends Error {}

/** Setup asked for twice — a route maps it to 409. */
export class WorkspaceAlreadyOpenError extends Error {}

function readStored(storePath: string): StoredWorkspace | null {
  try {
    return JSON.parse(readFileSync(storePath, "utf8"));
  } catch (error) {
    // Only a missing file means "not set up yet" — the same rule, and the same
    // reason, as `readMembers`.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function writeStored(storePath: string, stored: StoredWorkspace): void {
  mkdirSync(path.dirname(storePath), { recursive: true });
  // Write-then-rename, as `member-repository.ts` does: a crash mid-write must
  // not leave a workspace nobody can enter.
  const tempPath = `${storePath}.tmp`;
  writeFileSync(tempPath, JSON.stringify(stored, null, 2));
  renameSync(tempPath, storePath);
}

const hash = (password: string, salt: string) => scryptSync(password, salt, 32);

/** Development and CI only: `WORKSPACE_PASSWORD`/`WORKSPACE_NAME` stand in for
 *  the setup screen until the host has used it. People running the image leave
 *  them unset. Read per call so `next build` never trips over a missing `.env`. */
function envSeed(): { name: string; password: string } | null {
  const password = process.env.WORKSPACE_PASSWORD ?? "";
  if (password.length < MIN_PASSWORD_LENGTH) return null;
  return { name: process.env.WORKSPACE_NAME?.trim() || DEFAULT_WORKSPACE_NAME, password };
}

/** Whether guests can join yet (FR-010-04). */
export function isWorkspaceOpen(storePath = DEFAULT_WORKSPACE_PATH): boolean {
  return readStored(storePath) !== null || envSeed() !== null;
}

export function getWorkspaceName(storePath = DEFAULT_WORKSPACE_PATH): string {
  return readStored(storePath)?.name ?? envSeed()?.name ?? DEFAULT_WORKSPACE_NAME;
}

/** Constant-time so a guest cannot learn the password one character at a time
 *  from response timings — same treatment as `isHostSecret()`. */
export function isWorkspacePassword(
  candidate: string | undefined,
  storePath = DEFAULT_WORKSPACE_PATH,
): boolean {
  if (!candidate) return false;

  const stored = readStored(storePath);
  if (stored) {
    return timingSafeEqual(hash(candidate, stored.salt), Buffer.from(stored.passwordHash, "hex"));
  }

  const seed = envSeed();
  if (!seed) return false;
  const given = Buffer.from(candidate);
  const expected = Buffer.from(seed.password);
  // timingSafeEqual throws on a length mismatch, so the length guard comes first.
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function store(name: string, password: unknown, storePath: string): void {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new WorkspaceConfigError(`비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new WorkspaceConfigError(`워크스페이스 이름은 ${MAX_NAME_LENGTH}자 이하여야 합니다.`);
  }

  const salt = randomBytes(16).toString("hex");
  writeStored(storePath, { name, salt, passwordHash: hash(password, salt).toString("hex") });
}

/** FR-010-01~04: the setup screen's one action. Refused once open, so a second
 *  tab cannot silently replace a password guests were already given. */
export function openWorkspace(
  input: { name?: unknown; password?: unknown },
  storePath = DEFAULT_WORKSPACE_PATH,
): void {
  if (isWorkspaceOpen(storePath)) throw new WorkspaceAlreadyOpenError("이미 열린 워크스페이스입니다.");

  const name = typeof input.name === "string" ? input.name.trim() : "";
  store(name || DEFAULT_WORKSPACE_NAME, input.password, storePath);
}

/** FR-011-04~06: sessions are not touched — only the next join checks this. A
 *  workspace still on the env seed moves to the file here, name included. */
export function changeWorkspacePassword(password: unknown, storePath = DEFAULT_WORKSPACE_PATH): void {
  store(getWorkspaceName(storePath), password, storePath);
}
