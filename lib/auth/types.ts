/**
 * Shared contract between `app/api/workspace/join/route.ts` and the workspace
 * session registry (`session-registry.ts`), which owns who is in the workspace
 * and which session belongs to whom (FR-020-02/04/08).
 *
 * Everything here is in-memory by design. Sessions must not survive a restart —
 * `docs/design/api.md` makes restarting the container the revoke path — and
 * persisting members belongs to workspace restore (UC-010 E1-1), not here.
 */

/** Name of the httpOnly cookie carrying the guest's session id. */
export const SESSION_COOKIE = "workspace_session";

export type WorkspaceMember = {
  id: string;
  nickname: string;
  /** Assigned once per member, for the connected-user list (FR-020-07). */
  colorTag: string;
};

export type JoinResult = {
  member: WorkspaceMember;
  sessionId: string;
  /**
   * The session this join displaced, when the same nickname was already signed
   * in from another device (FR-020-08). The caller closes that device's socket;
   * the registry only knows the session stopped being valid.
   */
  revokedSessionId: string | null;
};

/** Thrown for input the guest controls — the route maps this to a 400, not a 500. */
export class JoinValidationError extends Error {}

/**
 * Thrown when the workspace has taken as many distinct members as it will hold.
 * Separate from `JoinValidationError` because the request was fine — the room is
 * not — so it deserves a 503 rather than a 400.
 */
export class WorkspaceFullError extends Error {}
