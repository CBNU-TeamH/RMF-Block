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
 * Beside `PresenceProvider`, not folded into it — "who *I* follow" is separate
 * state that merely checks itself against the same roster.
 *
 * It also owns the one effect that must run whatever page is showing: crossing
 * to the presenter's document on join (FR-030-05). In `editor.tsx` that step
 * would never fire for someone pressing 참여하기 from the document list.
 */
export function FocusFollowProvider({ children }: { children: React.ReactNode }) {
  const { members } = useWorkspacePresence();
  const [rawFollowingId, setRawFollowingId] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  // FR-030-11, and a presenter who simply clicked 종료: once the followed
  // member is gone or has stopped presenting there is nothing to follow.
  // Settled during render — neither ending fires an event, and the roster is
  // already in hand, so an effect would only re-render to the same answer.
  //
  // *Forgotten*, not merely derived away: a standing id would pull every
  // browser that once followed them into that presenter's next share.
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
