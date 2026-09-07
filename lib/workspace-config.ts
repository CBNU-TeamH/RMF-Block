import { timingSafeEqual } from "node:crypto";

/** The workspace name and access password the host sets before starting the
 *  server (FR-010-01/02). Chosen by a person and told to guests out of band, so
 *  the server never generates it and never rejects it for being simple — `1234`
 *  is legitimate for an hour on a LAN. The one rule is a length floor, to catch
 *  a typo or a half-filled `.env` rather than to enforce strength. */
const MIN_PASSWORD_LENGTH = 4;

const DEFAULT_WORKSPACE_NAME = "RMF Block";

export class WorkspaceConfigError extends Error {}

function readPassword(): string {
  const password = process.env.WORKSPACE_PASSWORD ?? "";

  // Read on each call rather than captured at module scope, so `next build`
  // (which loads these modules without a configured .env) never trips over it.
  // `assertWorkspaceConfigured()` is what turns this into a startup failure —
  // a workspace nobody can enter should fail while the host is still watching
  // the terminal, not silently reject every guest later.
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new WorkspaceConfigError(
      `WORKSPACE_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters — ` +
        `set it in .env before starting the server (see .env.sample).`,
    );
  }

  return password;
}

export function getWorkspaceName(): string {
  return process.env.WORKSPACE_NAME?.trim() || DEFAULT_WORKSPACE_NAME;
}

/**
 * Constant-time so a guest cannot learn the password one character at a time
 * from response timings — same treatment as `isHostSecret()`.
 */
export function isWorkspacePassword(candidate: string | undefined): boolean {
  if (!candidate) return false;

  const given = Buffer.from(candidate);
  const expected = Buffer.from(readPassword());
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Called at startup so a missing or too-short password fails loudly. */
export function assertWorkspaceConfigured(): void {
  readPassword();
}
