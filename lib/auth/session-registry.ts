import { randomUUID } from "node:crypto";

import {
  JoinValidationError,
  type JoinResult,
  type WorkspaceMember,
} from "./types.ts";

/**
 * Who is in the workspace, and which session belongs to whom (FR-020-04/08).
 *
 * The password check is not here. This registry runs only after the caller has
 * already accepted the password, so nothing in it can leak whether a guess was
 * close — and the takeover rules stay testable without an HTTP request.
 */

const NICKNAME_MAX_LENGTH = 20;

// Enough to tell eight people apart at a glance, which is the workspace size
// SRS §2.4 assumes. Handed out in order and reused once it wraps.
const COLOR_TAGS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
];

export class SessionRegistry {
  private readonly membersByNickname = new Map<string, WorkspaceMember>();
  private readonly memberBySession = new Map<string, WorkspaceMember>();
  private readonly sessionByMemberId = new Map<string, string>();

  /**
   * FR-020-08: a nickname already in the workspace re-enters as that same
   * member, and the newest connection becomes the live one. Signing in from a
   * phone while a laptop is still signed in is therefore not an error — the
   * laptop simply stops being the active device.
   */
  join(rawNickname: string | undefined): JoinResult {
    const nickname = rawNickname?.trim() ?? "";

    if (!nickname) {
      throw new JoinValidationError("nickname is required");
    }
    if (nickname.length > NICKNAME_MAX_LENGTH) {
      throw new JoinValidationError(
        `nickname must be at most ${NICKNAME_MAX_LENGTH} characters`,
      );
    }

    const member = this.membersByNickname.get(nickname) ?? this.addMember(nickname);

    // Read before the new session overwrites it, or the displaced device is
    // never told to stop.
    const revokedSessionId = this.sessionByMemberId.get(member.id) ?? null;
    if (revokedSessionId) {
      this.memberBySession.delete(revokedSessionId);
    }

    const sessionId = randomUUID();
    this.memberBySession.set(sessionId, member);
    this.sessionByMemberId.set(member.id, sessionId);

    return { member, sessionId, revokedSessionId };
  }

  /** The member a session belongs to, or null once it has been displaced. */
  resolve(sessionId: string | undefined): WorkspaceMember | null {
    if (!sessionId) return null;
    return this.memberBySession.get(sessionId) ?? null;
  }

  private addMember(nickname: string): WorkspaceMember {
    const member: WorkspaceMember = {
      id: randomUUID(),
      nickname,
      colorTag: COLOR_TAGS[this.membersByNickname.size % COLOR_TAGS.length]!,
    };
    this.membersByNickname.set(nickname, member);
    return member;
  }
}

// Cached on `globalThis` for the same reason as `server/ws-hub.mts`: this module
// is loaded twice in one process — once through Next's bundled module graph and
// once by Node's native loader — and two private registries would mean a session
// issued on one side never resolving on the other.
const cache = globalThis as { __sessionRegistry?: SessionRegistry };

export const sessionRegistry = (cache.__sessionRegistry ??= new SessionRegistry());
