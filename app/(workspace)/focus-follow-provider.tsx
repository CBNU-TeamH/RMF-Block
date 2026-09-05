"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

import { documentIdFromPathname } from "@/lib/focus/pathname";

import { useWorkspacePresence } from "./presence-provider";

type FocusFollowState = {
  /** Local UI state, never published — who is *presenting* is shared presence,
   *  who follows whom is nobody else's business (`presence-and-focus.md`). */
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

/** Beside `PresenceProvider`, not folded into it (`presence-and-focus.md`). It
 *  owns the one effect that must run whatever page is showing: crossing to the
 *  presenter's document on join (FR-030-05), which in `editor.tsx` would never
 *  fire for someone pressing 참여하기 from the document list. */
export function FocusFollowProvider({ children }: { children: React.ReactNode }) {
  const { members } = useWorkspacePresence();
  const [rawFollowingId, setRawFollowingId] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  // FR-030-11, and a presenter who clicked 종료. Settled during render: neither
  // ending fires an event and the roster is in hand. *Forgotten*, not derived
  // away — a standing id would pull this browser into their next share.
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
