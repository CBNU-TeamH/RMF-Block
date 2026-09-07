import { randomUUID } from "node:crypto";

import { DEFAULT_MEMBERS_PATH, readMembers, writeMembers } from "./member-repository.ts";
import {
  JoinValidationError,
  MemberStoreError,
  WorkspaceFullError,
  type JoinResult,
  type StoredMember,
  type WorkspaceMember,
} from "./types.ts";

/** Who is in the workspace, and which session belongs to whom (FR-020-04/08).
 *  The password check is deliberately elsewhere — why, and the three decisions
 *  this makes: `docs/design/api.md`, "What the session registry decides". */

const NICKNAME_MAX_LENGTH = 20;

/** The ceiling that bounds memory (SRS §2.4 sizes a workspace at 8). */
const MAX_MEMBERS = 64;

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
  private readonly lastJoinedAt = new Map<string, string>();

  /** Where members are kept between runs, or undefined for one that forgets —
   *  which is what makes persistence optional rather than assumed. */
  private readonly storePath: string | undefined;

  constructor(storePath?: string) {
    this.storePath = storePath;
    if (!storePath) return;

    for (const stored of readMembers(storePath)) {
      const { lastJoinedAt, ...member } = stored;
      this.membersByNickname.set(member.nickname, member);
      this.lastJoinedAt.set(member.id, lastJoinedAt);
    }
    // Sessions are pointedly not restored: every member comes back signed out.
  }

  /** Every member this workspace has recorded, newest sign-in first. */
  members(): Array<StoredMember> {
    return [...this.membersByNickname.values()]
      .map((member) => ({
        ...member,
        lastJoinedAt: this.lastJoinedAt.get(member.id) ?? "",
      }))
      .sort((a, b) => b.lastJoinedAt.localeCompare(a.lastJoinedAt));
  }

  private persist(): void {
    if (this.storePath) writeMembers(this.storePath, this.members());
  }

  /** FR-020-08: a known nickname re-enters as that member and the newest
   *  connection becomes the live one — a phone signing in past a laptop is not
   *  an error. */
  join(rawNickname: string | undefined): JoinResult {
    const nickname = rawNickname?.trim() ?? "";

    if (!nickname) {
      throw new JoinValidationError("닉네임을 입력해 주세요.");
    }
    if (nickname.length > NICKNAME_MAX_LENGTH) {
      throw new JoinValidationError(
        `닉네임은 ${NICKNAME_MAX_LENGTH}자 이하여야 합니다.`,
      );
    }

    // Checked before creating, so a returning nickname is never turned away by a
    // workspace that is already full.
    const existing = this.membersByNickname.get(nickname);
    if (!existing && this.membersByNickname.size >= MAX_MEMBERS) {
      throw new WorkspaceFullError(
        `이 워크스페이스는 ${MAX_MEMBERS}명까지만 참여할 수 있습니다.`,
      );
    }

    const member = existing ?? this.addMember(nickname);

    // Read before the new session overwrites it, or the displaced device is
    // never told to stop.
    const revokedSessionId = this.sessionByMemberId.get(member.id) ?? null;
    if (revokedSessionId) {
      this.memberBySession.delete(revokedSessionId);
    }

    const sessionId = randomUUID();
    this.memberBySession.set(sessionId, member);
    this.sessionByMemberId.set(member.id, sessionId);

    // Stamped on every join, not just the first: it answers "is this record
    // still anyone?", which is the question the host has when clearing out
    // members they do not recognise.
    this.lastJoinedAt.set(member.id, new Date().toISOString());

    try {
      this.persist();
    } catch (error) {
      // Rollback for a new member only — the two cases are not the same failure
      // (`docs/design/api.md`).
      console.error("could not write members.json", error);
      if (!existing) {
        this.membersByNickname.delete(nickname);
        this.memberBySession.delete(sessionId);
        this.sessionByMemberId.delete(member.id);
        this.lastJoinedAt.delete(member.id);
        throw new MemberStoreError(
          "참가자 정보를 저장하지 못했습니다. 호스트에게 서버 저장 공간을 확인해 달라고 알려주세요.",
        );
      }
    }

    return { member, sessionId, revokedSessionId };
  }

  /** Whether joining under this nickname would throw someone out (FR-020-08).
   *  Why it reads `memberBySession`: `docs/design/api.md`. */
  hasLiveSession(rawNickname: string | undefined): boolean {
    const member = this.membersByNickname.get(rawNickname?.trim() ?? "");
    if (!member) return false;

    const sessionId = this.sessionByMemberId.get(member.id);
    return sessionId !== undefined && this.memberBySession.has(sessionId);
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

// On `globalThis` like `server/ws-hub.mts`: this module is loaded twice in one
// process, and two registries would mean a session issued on one side never
// resolving on the other.
const cache = globalThis as { __sessionRegistry?: SessionRegistry };

export const sessionRegistry = (cache.__sessionRegistry ??= new SessionRegistry(DEFAULT_MEMBERS_PATH));
