"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

import { documentIdFromPathname } from "@/lib/focus/pathname";

import { useWorkspacePresence } from "./presence-provider";

type FocusFollowState = {
  /** The member id this browser is following, or `null`. Purely local UI
   * state — never published. Only *who is presenting* is shared workspace
   * presence (`lib/presence/types.ts`); who is following whom is nobody
   * else's business — see `docs/design/presence-and-focus.md`. */
  followingId: string | null;
  follow: (memberId: string) => void;
  unfollow: () => void;
};

const FocusFollowContext = createContext<FocusFollowState>({
  followingId: null,
  follow: () => undefined,
  unfollow: () => undefined,
});

export function useFocusFollow(): FocusFollowState {
  return useContext(FocusFollowContext);
}

/**
 * Colocated with `PresenceProvider` rather than folded into it: this is a
 * second, unrelated piece of state (who *I* am following) that only
 * happens to want the same roster to check itself against, not a shared
 * concern with "who is present."
 *
 * Also owns the one side effect that has to run no matter which page is
 * showing — crossing to the presenter's document on join (FR-030-05).
 * `editor.tsx` only ever mounts while already on a `/documents/[id]` page,
 * so if that step lived there instead, clicking 참여하기 from the document
 * list — no editor mounted at all — would set `followingId` and nothing
 * would ever act on it.
 */
export function FocusFollowProvider({ children }: { children: React.ReactNode }) {
  const { members } = useWorkspacePresence();
  const [rawFollowingId, setRawFollowingId] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  // FR-030-11, and the same rule for a presenter who simply clicked 종료
  // themselves: once the followed member is gone, or has stopped presenting,
  // there is nothing left to follow. Settled during render rather than from
  // an effect — neither ending fires an event of its own to react to
  // (presence just stops carrying `presenting`, or stops carrying the member
  // at all), and the roster we would be synchronizing against is already in
  // hand this render, so an effect would only re-render a second time to
  // reach the same answer. This is React's "adjusting state during render".
  //
  // The follow is *forgotten*, not merely derived away: leaving the raw id
  // standing would let the same presenter's *next* share pull every browser
  // that once followed them straight back in, with no 참여하기 pressed.
  const target = rawFollowingId ? members.find((m) => m.id === rawFollowingId) : undefined;
  if (rawFollowingId && !target?.presenting) setRawFollowingId(null);
  const followingId = target?.presenting ? rawFollowingId : null;

  // FR-030-05: joining brings the follower to the presenter's document, not
  // just their position within one already open.
  useEffect(() => {
    if (!followingId) return;
    const documentId = members.find((m) => m.id === followingId)?.presenting?.documentId;
    if (!documentId || documentId === documentIdFromPathname(pathname)) return;
    router.push(`/documents/${documentId}`);
  }, [followingId, members, pathname, router]);

  const value: FocusFollowState = {
    followingId,
    follow: setRawFollowingId,
    unfollow: () => setRawFollowingId(null),
  };

  return <FocusFollowContext.Provider value={value}>{children}</FocusFollowContext.Provider>;
}
