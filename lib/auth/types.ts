/**
 * Shared contract between `app/api/workspace/join/route.ts` and the workspace
 * session registry (`session-registry.ts`), which owns who is in the workspace
 * and which session belongs to whom (FR-020-02/04/08).
 *
 * Members persist (`member-repository.ts`); sessions do not, and must not —
 * `docs/design/api.md` makes restarting the container the revoke path, and a
 * session id written to disk would be a permanent bearer token sitting on the
 * host's filesystem.
 */

/** Name of the httpOnly cookie carrying the guest's session id. */
export const SESSION_COOKIE = "workspace_session";

export type WorkspaceMember = {
  id: string;
  nickname: string;
  /** Assigned once per member, for the connected-user list (FR-020-07). */
  colorTag: string;
};

/**
 * What the store keeps, which is the identity plus one field the identity does
 * not need. `lastJoinedAt` stays off `WorkspaceMember` on purpose: that type is
 * also `WorkspacePresence` (`lib/presence/types.ts`), so every field on it is
 * published to every other browser, and when someone last signed in is nobody
 * else's business. The host reads it on the Members screen as 최근 접속.
 */
export type StoredMember = WorkspaceMember & { lastJoinedAt: string };

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
 * Thrown when a first-time join could not be written to disk. The registry has
 * already rolled itself back by then, so the nickname is free to try again —
 * which is the whole point of telling the caller rather than swallowing it.
 * A *returning* member never raises this: their record is already on disk.
 */
export class MemberStoreError extends Error {}

/**
 * Thrown when the workspace has taken as many distinct members as it will hold.
 * Separate from `JoinValidationError` because the request was fine — the room is
 * not — so it deserves a 503 rather than a 400.
 */
export class WorkspaceFullError extends Error {}
