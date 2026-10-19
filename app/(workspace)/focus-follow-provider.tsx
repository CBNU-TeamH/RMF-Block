"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { documentIdFromPathname } from "@/lib/focus/pathname";

import type { WorkspacePresence } from "@/lib/presence/types";

import { useWorkspacePresence } from "./presence-provider";

type Place = NonNullable<WorkspacePresence["location"]>;

/** `highlight` marks a landing someone asked for by the block (UC-050 E3-3). */
type ScrollTarget = Place & { highlight?: boolean };

type FocusFollowState = {
  /** Local UI state, never published — who is *presenting* is shared presence,
   *  who follows whom is nobody else's business (`presence-and-focus.md`). */
  followingId: string | null;
  follow: (memberId: string) => void;
  unfollow: () => void;
  /** UC-040: go to where a member is (FR-040-02). Ends any follow. */
  jumpTo: (memberId: string) => void;
  /** Where `jumpTo` left from — a place, or `"home"` for the page with no document — or `null`. One place, replaced by the next jump (FR-040-03). */
  returnTo: Place | "home" | null;
  goBack: () => void;
  /** UC-050 E3-3: open a document at a block and highlight it. Ends any follow. */
  goToBlock: (documentId: string, blockId: string) => void;
  /** A block the editor of `documentId` should scroll to once it has loaded. */
  scrollTarget: ScrollTarget | null;
  clearScrollTarget: () => void;
};

const FocusFollowContext = createContext<FocusFollowState>({
  followingId: null,
  follow: () => undefined,
  unfollow: () => undefined,
  jumpTo: () => undefined,
  returnTo: null,
  goBack: () => undefined,
  goToBlock: () => undefined,
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
  const [returnTo, setReturnTo] = useState<Place | "home" | null>(null);
  const [scrollTarget, setScrollTarget] = useState<ScrollTarget | null>(null);
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

  function goTo(place: ScrollTarget) {
    setScrollTarget(place);
    if (place.documentId !== documentIdFromPathname(pathname)) {
      router.push(`/documents/${place.documentId}`);
    }
  }

  const clearScrollTarget = useCallback(() => setScrollTarget(null), []);

  /** A follow would pull this browser straight back to the presenter, so moving
   *  on means leaving it — ask first. `false` when they would rather stay. */
  function leaveFollow(): boolean {
    if (!followingId) return true;
    if (!window.confirm("따라가기를 종료하고 이동하시겠습니까?")) return false;
    setRawFollowingId(null);
    return true;
  }

  function jumpTo(targetId: string) {
    const place = members.find((m) => m.id === targetId)?.location;
    if (!place || !leaveFollow()) return;
    setReturnTo(members.find((m) => m.id === memberId)?.location ?? "home");
    goTo(place);
  }

  function goToBlock(documentId: string, blockId: string) {
    if (leaveFollow()) goTo({ documentId, blockId, highlight: true });
  }

  function goBack() {
    if (!returnTo) return;
    if (returnTo === "home") router.push("/");
    else goTo(returnTo);
    setReturnTo(null);
  }

  // A jump whose document never loads (deleted, navigation failed) must not
  // linger and scroll the next time that document opens.
  useEffect(() => {
    if (!scrollTarget) return;
    const timer = setTimeout(clearScrollTarget, 10_000);
    return () => clearTimeout(timer);
  }, [scrollTarget, clearScrollTarget]);

  const value: FocusFollowState = {
    followingId,
    follow: setRawFollowingId,
    unfollow: () => setRawFollowingId(null),
    jumpTo,
    returnTo,
    goBack,
    goToBlock,
    scrollTarget,
    clearScrollTarget,
  };

  return <FocusFollowContext.Provider value={value}>{children}</FocusFollowContext.Provider>;
}
