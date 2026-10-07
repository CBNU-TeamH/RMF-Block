"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { documentIdFromPathname } from "@/lib/focus/pathname";

import type { WorkspacePresence } from "@/lib/presence/types";

import { useWorkspacePresence } from "./presence-provider";

type Place = NonNullable<WorkspacePresence["location"]>;

type FocusFollowState = {
  /** Local UI state, never published — who is *presenting* is shared presence,
   *  who follows whom is nobody else's business (`presence-and-focus.md`). */
  followingId: string | null;
  follow: (memberId: string) => void;
  unfollow: () => void;
  /** UC-040: go to where a member is (FR-040-02). Ends any follow. */
  jumpTo: (memberId: string) => void;
  /** Where `jumpTo` left from, or `null` — one place, replaced by the next jump (FR-040-03). */
  returnTo: Place | null;
  goBack: () => void;
  /** A block the editor of `documentId` should scroll to once it has loaded. */
  scrollTarget: Place | null;
  clearScrollTarget: () => void;
};

const FocusFollowContext = createContext<FocusFollowState>({
  followingId: null,
  follow: () => undefined,
  unfollow: () => undefined,
  jumpTo: () => undefined,
  returnTo: null,
  goBack: () => undefined,
  scrollTarget: null,
  clearScrollTarget: () => undefined,
});

export function useFocusFollow(): FocusFollowState {
  return useContext(FocusFollowContext);
}

/** Beside `PresenceProvider`, not folded into it (`presence-and-focus.md`). It
 *  owns the one effect that must run whatever page is showing: crossing to the
 *  presenter's document on join (FR-030-05), which in `editor.tsx` would never
 *  fire for someone pressing 참여하기 from the document list. */
export function FocusFollowProvider({ children }: { children: React.ReactNode }) {
  const { members, memberId } = useWorkspacePresence();
  const [rawFollowingId, setRawFollowingId] = useState<string | null>(null);
  const [returnTo, setReturnTo] = useState<Place | null>(null);
  const [scrollTarget, setScrollTarget] = useState<Place | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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

  const goTo = useCallback(
    (place: Place) => {
      setScrollTarget(place);
      if (place.documentId !== documentIdFromPathname(pathname)) {
        router.push(`/documents/${place.documentId}`);
      }
    },
    [pathname, router],
  );

  const clearScrollTarget = useCallback(() => setScrollTarget(null), []);

  function jumpTo(targetId: string) {
    const place = members.find((m) => m.id === targetId)?.location;
    if (!place) return;

    // A follow would pull this browser straight back to the presenter.
    if (followingId) {
      setRawFollowingId(null);
      setNotice("직접 이동해서 따라가기를 종료했어요.");
    }
    setReturnTo(members.find((m) => m.id === memberId)?.location ?? null);
    goTo(place);
  }

  function goBack() {
    if (!returnTo) return;
    goTo(returnTo);
    setReturnTo(null);
  }

  // Not a toast library: one line that clears itself.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const value: FocusFollowState = {
    followingId,
    follow: setRawFollowingId,
    unfollow: () => setRawFollowingId(null),
    jumpTo,
    returnTo,
    goBack,
    scrollTarget,
    clearScrollTarget,
  };

  return (
    <FocusFollowContext.Provider value={value}>
      {children}
      {notice ? (
        <p
          role="alert"
          className="fixed top-14 left-1/2 z-50 -translate-x-1/2 rounded-md bg-ink px-3 py-2 text-[13px] text-paper shadow-lg"
        >
          {notice}
        </p>
      ) : null}
    </FocusFollowContext.Provider>
  );
}
