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

/** An error recognised by its explicit `name`, not its class: two copies of this module meet in one
 *  process (#273). */
function namedError(name: string) {
  return class extends Error {
    override readonly name = name;
    static [Symbol.hasInstance](value: unknown): boolean {
      return value instanceof Error && value.name === name;
    }
  };
}

/** Thrown for input the guest controls — the route maps this to a 400, not a 500. */
export class JoinValidationError extends namedError("JoinValidationError") {}

/** A first-time join that could not reach disk. The registry has already rolled
 *  back, so the nickname is free to retry — which is why this is raised rather
 *  than swallowed. A returning member never hits it. */
export class MemberStoreError extends namedError("MemberStoreError") {}

/** The workspace is full. Separate from `JoinValidationError` because the
 *  request was fine and the room is not: 503, not 400. */
export class WorkspaceFullError extends namedError("WorkspaceFullError") {}
