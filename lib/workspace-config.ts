import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

/** The workspace name and access password (FR-010-01/02), set by the host on
 *  the setup screen and kept in `.data/` so a restart resumes the same
 *  workspace (FR-010-05, NFR-REL-002). Chosen by a person and told to guests out
 *  of band, so the server never rejects it for being simple — `1234` is
 *  legitimate for an hour on a LAN. The one rule is a length floor, to catch a
 *  typo rather than to enforce strength. */
const MIN_PASSWORD_LENGTH = 4;
const MAX_NAME_LENGTH = 40;

const DEFAULT_WORKSPACE_NAME = "RMF Block";

const DEFAULT_WORKSPACE_PATH = path.resolve(".data/workspace.json");

/** Hashed, never the password itself: `.data/` sits on the host's disk and in
 *  backups of the volume. */
type StoredWorkspace = { name: string; salt: string; passwordHash: string };

/** Input the host controls — a route maps it to 400. */
export class WorkspaceConfigError extends Error {}

// Async, on libuv's pool: scrypt is ~40ms by design, and a sync call would
// stall every socket this process serves for each join attempt.
const scryptAsync = promisify(scrypt) as (password: string, salt: string, length: number) => Promise<Buffer>;
const hash = (password: string, salt: string) => scryptAsync(password, salt, 32);

const isStored = (value: unknown): value is StoredWorkspace => {
  const v = value as Partial<StoredWorkspace> | null;
  return (
    typeof v?.name === "string" &&
    typeof v.salt === "string" &&
    typeof v.passwordHash === "string" &&
    /^[0-9a-f]{64}$/.test(v.passwordHash)
  );
};

const reportedDamaged = new Set<string>();

/** `null` when there is nothing usable to read. Unlike `readMembers`, a file
 *  that does not parse, or parses into the wrong shape, counts as "not set up"
 *  rather than an error: a broken hash protects nothing worth keeping, and the
 *  setup screen rewriting the file is the recovery — where throwing would 500
 *  every page and leave the host no way back through the UI. An I/O error
 *  (permissions, disk) still throws; writing would fail the same way. */
function readStored(storePath: string): StoredWorkspace | null {
  let raw: string;
  try {
    raw = readFileSync(storePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  if (isStored(parsed)) return parsed;

  // Once per path: this is read on every request.
  if (!reportedDamaged.has(storePath)) {
    reportedDamaged.add(storePath);
    console.error(`  ✗ ${storePath} is damaged — treating the workspace as not set up; the host can set it up again.`);
  }
  return null;
}

function writeStored(storePath: string, stored: StoredWorkspace): void {
  mkdirSync(path.dirname(storePath), { recursive: true });
  // Write-then-rename, as `member-repository.ts` does: a crash mid-write must
  // not leave a workspace nobody can enter.
  const tempPath = `${storePath}.tmp`;
  writeFileSync(tempPath, JSON.stringify(stored, null, 2));
  renameSync(tempPath, storePath);
}

/** Whether guests can join yet (FR-010-04). */
export function isWorkspaceOpen(storePath = DEFAULT_WORKSPACE_PATH): boolean {
  return readStored(storePath) !== null;
}

export function getWorkspaceName(storePath = DEFAULT_WORKSPACE_PATH): string {
  return readStored(storePath)?.name ?? DEFAULT_WORKSPACE_NAME;
}

/** Constant-time so a guest cannot learn the password one character at a time
 *  from response timings — same treatment as `isHostSecret()`. */
export async function isWorkspacePassword(
  candidate: string | undefined,
  storePath = DEFAULT_WORKSPACE_PATH,
): Promise<boolean> {
  const stored = readStored(storePath);
  if (!candidate || !stored) return false;
  // Both 32 bytes — `isStored` checked the hash's length, which
  // timingSafeEqual would otherwise throw on.
  return timingSafeEqual(await hash(candidate, stored.salt), Buffer.from(stored.passwordHash, "hex"));
}

/** `mode` is checked after the hash and right before the write, with no await
 *  between them — the one place two requests cannot both pass: setup only
 *  creates (`"new"`), a password change only replaces (`"existing"`). */
async function store(
  name: string,
  password: unknown,
  storePath: string,
  mode: "new" | "existing",
): Promise<boolean> {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new WorkspaceConfigError(`비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new WorkspaceConfigError(`워크스페이스 이름은 ${MAX_NAME_LENGTH}자 이하여야 합니다.`);
  }

  const salt = randomBytes(16).toString("hex");
  const passwordHash = (await hash(password, salt)).toString("hex");
  if (isWorkspaceOpen(storePath) !== (mode === "existing")) return false;
  writeStored(storePath, { name, salt, passwordHash });
  return true;
}

/** FR-010-01~04: the setup screen's one action. `false` once the workspace is
 *  open, so a second tab cannot replace a password guests were already given —
 *  changing it is `changeWorkspacePassword`. */
export function openWorkspace(
  input: { name?: unknown; password?: unknown },
  storePath = DEFAULT_WORKSPACE_PATH,
): Promise<boolean> {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  return store(name || DEFAULT_WORKSPACE_NAME, input.password, storePath, "new");
}

/** FR-011-04~06: sessions are not touched — only the next join checks this.
 *  `false` before setup: changing a password must not create the workspace and
 *  skip the setup screen's name. */
export function changeWorkspacePassword(password: unknown, storePath = DEFAULT_WORKSPACE_PATH): Promise<boolean> {
  return store(getWorkspaceName(storePath), password, storePath, "existing");
}

/** Development and CI only, run once at startup: `WORKSPACE_PASSWORD` (and
 *  `WORKSPACE_NAME`) open a workspace that has never been set up, standing in
 *  for the setup screen. Once the file exists they are never read — people
 *  running the image leave them unset. */
export async function seedWorkspaceFromEnv(storePath = DEFAULT_WORKSPACE_PATH): Promise<void> {
  const password = process.env.WORKSPACE_PASSWORD ?? "";
  if (isWorkspaceOpen(storePath) || password.length < MIN_PASSWORD_LENGTH) return;
  await openWorkspace({ name: process.env.WORKSPACE_NAME, password }, storePath);
}
