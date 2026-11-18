/** Shared contract between the join route and `session-registry.ts`
 *  (FR-020-02/04/08). Members persist, sessions must not — why:
 *  `docs/design/api.md`, Authentication model. */

/** Name of the httpOnly cookie carrying the guest's session id. */
export const SESSION_COOKIE = "workspace_session";

export type WorkspaceMember = {
  id: string;
  nickname: string;
  /** Assigned once per member, for the connected-user list (FR-020-07). */
  colorTag: string;
};

/** The identity plus one field it must not carry — why `lastJoinedAt` is here
 *  and not on `WorkspaceMember`: `docs/design/api.md`. */
export type StoredMember = WorkspaceMember & { lastJoinedAt: string };

export type JoinResult = {
  member: WorkspaceMember;
  sessionId: string;
  /** The session this join displaced (FR-020-08). Closing that device's socket
   *  is the caller's job; the registry only knows it stopped being valid. */
  revokedSessionId: string | null;
};

/** Whether `value` is an error with this `name`. These three errors cross a module boundary that
 *  `instanceof` cannot: `session-registry.ts` is loaded twice in one process (by `server/index.mts` as
 *  native ESM, and by the Next route bundle) and the registry is shared through `globalThis`, so a
 *  registry made by one copy throws the classes of that copy while the route checks the other's (#273).
 *  The name is an explicit string, not `constructor.name`, which a minifier renames. */
function isNamed(value: unknown, name: string): boolean {
  return value instanceof Error && value.name === name;
}

/** Thrown for input the guest controls — the route maps this to a 400, not a 500. */
export class JoinValidationError extends Error {
  override readonly name = "JoinValidationError";
  static [Symbol.hasInstance](value: unknown): boolean {
    return isNamed(value, "JoinValidationError");
  }
}

/** A first-time join that could not reach disk. The registry has already rolled
 *  back, so the nickname is free to retry — which is why this is raised rather
 *  than swallowed. A returning member never hits it. */
export class MemberStoreError extends Error {
  override readonly name = "MemberStoreError";
  static [Symbol.hasInstance](value: unknown): boolean {
    return isNamed(value, "MemberStoreError");
  }
}

/** The workspace is full. Separate from `JoinValidationError` because the
 *  request was fine and the room is not: 503, not 400. */
export class WorkspaceFullError extends Error {
  override readonly name = "WorkspaceFullError";
  static [Symbol.hasInstance](value: unknown): boolean {
    return isNamed(value, "WorkspaceFullError");
  }
}
