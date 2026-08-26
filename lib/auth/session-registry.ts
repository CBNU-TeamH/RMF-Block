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

/**
 * Who is in the workspace, and which session belongs to whom (FR-020-04/08).
 *
 * The password check is not here. This registry runs only after the caller has
 * already accepted the password, so nothing in it can leak whether a guess was
 * close — and the takeover rules stay testable without an HTTP request.
 */

const NICKNAME_MAX_LENGTH = 20;

/**
 * Every distinct nickname adds a member that is never removed, so without a
 * ceiling a guest who knows the password could spend the process's memory one
 * join at a time. SRS §2.4 sizes a workspace at 8 people; this leaves room for
 * nicknames changing their mind through a session and still bounds the damage.
 */
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

  /**
   * Where members are kept between runs, or undefined for a registry that
   * forgets — which is what the unit tests want, and what makes persistence a
   * thing this class *can* do rather than a thing it always does.
   */
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

  /**
   * FR-020-08: a nickname already in the workspace re-enters as that same
   * member, and the newest connection becomes the live one. Signing in from a
   * phone while a laptop is still signed in is therefore not an error — the
   * laptop simply stops being the active device.
   */
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
      // The two cases are not the same failure.
      //
      // A returning member is already on disk, so all a failed write loses is a
      // fresher `lastJoinedAt`. Letting the join through degrades to exactly how
      // this worked before members persisted at all, which is a state the app
      // has already run in. Swallowing it is the lesser harm.
      //
      // A brand-new member was never durable, and every mutation above belongs
      // to this call — a member with no previous session cannot have displaced
      // anyone, so `revokedSessionId` is always null here and there is no other
      // device's session to put back. That makes the rollback total, and leaving
      // the mutations in place instead would strand a session nobody holds:
      // `hasLiveSession()` would say the nickname is taken, the guest would meet
      // a 409 telling them to displace a device that does not exist, and the
      // name would stay locked until the process restarted.
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

  /**
   * Whether joining under this nickname would throw someone out.
   *
   * True means a session for that member is still valid, so `join()` would
   * revoke it (FR-020-08) — which is right for one person's second device and
   * wrong for two people who happened to pick the same name. The registry
   * cannot tell those apart, so the route asks the guest instead of guessing.
   *
   * `sessionByMemberId` alone is not the answer: it keeps the newest session id
   * forever, so it would say "live" for anyone who ever joined. A session is
   * live only while `memberBySession` still resolves it, which is exactly what
   * a takeover deletes.
   */
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

// Cached on `globalThis` for the same reason as `server/ws-hub.mts`: this module
// is loaded twice in one process — once through Next's bundled module graph and
// once by Node's native loader — and two private registries would mean a session
// issued on one side never resolving on the other. Both loads read the same
// file, so whichever constructs first wins and the other reuses it.
const cache = globalThis as { __sessionRegistry?: SessionRegistry };

export const sessionRegistry = (cache.__sessionRegistry ??= new SessionRegistry(DEFAULT_MEMBERS_PATH));
