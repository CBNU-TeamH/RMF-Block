"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { documentIdFromPathname } from "@/lib/focus/pathname";

import type { WorkspacePresence } from "@/lib/presence/types";

import { useWorkspacePresence } from "./presence-provider";

type Place = NonNullable<WorkspacePresence["location"]>;

/** `highlight` marks a landing someone asked for by the block (UC-050 E3-3). */
type ScrollTarget = Place & { highlight?: boolean };

/** How long "공유가 종료되었습니다" stays (UC-030 E3-3). */
export const SHARE_ENDED_MS = 4000;

/** Who the ended share was by — kept from the join, since a presenter who left
 *  is no longer in the roster to look up. */
export type EndedShare = { nickname: string; colorTag: string };

type FocusFollowState = {
  /** Local UI state, never published — who is *presenting* is shared presence,
   *  who follows whom is nobody else's business (`presence-and-focus.md`).
   *  `null` while the follow is paused: only a running follow drives the view. */
  followingId: string | null;
  /** The presenter of a paused follow (FR-030-08), or `null`. */
  pausedId: string | null;
  follow: (memberId: string) => void;
  unfollow: () => void;
  /** UC-030 E3-1: stop the view following without leaving; `resume` re-syncs it. */
  pause: () => void;
  resume: () => void;
  /** UC-030 E3-3: the share being followed has just ended. Clears itself. */
  shareEnded: EndedShare | null;
  /** UC-040: go to where a member is (FR-040-02). Pauses any follow. */
  jumpTo: (memberId: string) => void;
  /** Where `jumpTo` left from — a place, or `"home"` for the page with no document — or `null`. One place, replaced by the next jump (FR-040-03). */
  returnTo: Place | "home" | null;
  goBack: () => void;
  /** UC-050 E3-3: open a document at a block and highlight it. Pauses any follow. */
  goToBlock: (documentId: string, blockId: string) => void;
  /** A block the editor of `documentId` should scroll to once it has loaded. */
  scrollTarget: ScrollTarget | null;
  clearScrollTarget: () => void;
};

const FocusFollowContext = createContext<FocusFollowState>({
  followingId: null,
  pausedId: null,
  follow: () => undefined,
  unfollow: () => undefined,
  pause: () => undefined,
  resume: () => undefined,
  shareEnded: null,
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
  const [paused, setPaused] = useState(false);
  const [followed, setFollowed] = useState<EndedShare | null>(null);
  const [shareEnded, setShareEnded] = useState<EndedShare | null>(null);
  const [returnTo, setReturnTo] = useState<Place | "home" | null>(null);
  const [scrollTarget, setScrollTarget] = useState<ScrollTarget | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  // FR-030-11, and a presenter who clicked 종료. Settled during render: neither
  // ending fires an event and the roster is in hand. *Forgotten*, not derived
  // away — a standing id would pull this browser into their next share.
  // The same branch tells the follower the share ended (E3-3).
  const target = rawFollowingId ? members.find((m) => m.id === rawFollowingId) : undefined;
  if (rawFollowingId && !target?.presenting) {
    setRawFollowingId(null);
    setPaused(false);
    setShareEnded(followed);
  }
  const followedId = target?.presenting ? rawFollowingId : null;
  const followingId = paused ? null : followedId;
  const pausedId = paused ? followedId : null;

  const pause = useCallback(() => setPaused(true), []);

  // Where this provider last sent the browser, and the route it last saw: a
  // route change it did not make is the follower's own (`presence-and-focus.md`).
  const sentToRef = useRef<string | null>(null);
  const seenPathRef = useRef(pathname);

  // FR-030-05: joining brings the follower to the presenter's document, not
  // just their position within one already open, and so does the presenter
  // moving to another. The follower opening one themselves pauses (E3-1).
  useEffect(() => {
    const moved = seenPathRef.current !== pathname;
    seenPathRef.current = pathname;
    if (!followingId) {
      sentToRef.current = null;
      return;
    }

    const documentId = members.find((m) => m.id === followingId)?.presenting?.documentId;
    const here = documentIdFromPathname(pathname);
    if (!documentId || documentId === here) return;
    if (moved && (sentToRef.current === null || here !== sentToRef.current)) {
      pause();
      return;
    }
    if (sentToRef.current === documentId) return;
    sentToRef.current = documentId;
    router.push(`/documents/${documentId}`);
  }, [followingId, members, pathname, router, pause]);

  useEffect(() => {
    if (!shareEnded) return;
    const timer = setTimeout(() => setShareEnded(null), SHARE_ENDED_MS);
    return () => clearTimeout(timer);
  }, [shareEnded]);

  function goTo(place: ScrollTarget) {
    setScrollTarget(place);
    if (place.documentId !== documentIdFromPathname(pathname)) {
      router.push(`/documents/${place.documentId}`);
    }
  }

  const clearScrollTarget = useCallback(() => setScrollTarget(null), []);

  // A running follow would pull this browser straight back, so moving on is the
  // follower's own move (E3-1): paused, not ended, and 재개 still returns.
  function jumpTo(targetId: string) {
    const place = members.find((m) => m.id === targetId)?.location;
    if (!place) return;
    pause();
    setReturnTo(members.find((m) => m.id === memberId)?.location ?? "home");
    goTo(place);
  }

  function goToBlock(documentId: string, blockId: string) {
    pause();
    goTo({ documentId, blockId, highlight: true });
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
    pausedId,
    follow: (id) => {
      const presenter = members.find((m) => m.id === id);
      setRawFollowingId(id);
      setFollowed(presenter ? { nickname: presenter.nickname, colorTag: presenter.colorTag } : null);
      setPaused(false);
      setShareEnded(null);
    },
    unfollow: () => {
      setRawFollowingId(null);
      setPaused(false);
    },
    pause,
    resume: () => setPaused(false),
    shareEnded,
    jumpTo,
    returnTo,
    goBack,
    goToBlock,
    scrollTarget,
    clearScrollTarget,
  };

  return <FocusFollowContext.Provider value={value}>{children}</FocusFollowContext.Provider>;
}
