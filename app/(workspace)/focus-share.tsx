"use client";

import { usePathname } from "next/navigation";

import { anchorAt } from "@/lib/focus/anchor";
import { readBoxes } from "@/lib/focus/dom";
import { documentIdFromPathname } from "@/lib/focus/pathname";

import { useFocusFollow } from "./focus-follow-provider";
import { useWorkspacePresence } from "./presence-provider";

/** 30px, radius 9 (`docs/ui/redesign/HANDOFF.md` §3); each state adds its colours. */
const BUTTON =
  "flex h-[30px] items-center gap-1.5 rounded-control px-2.5 text-[13.5px] font-medium disabled:opacity-40";
const SHARE_ICON = (
  <svg aria-hidden width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 10V2.5M5 5.5l3-3 3 3M3.5 9v4h9V9" />
  </svg>
);

/** The one header control for UC-030's thin slice: 공유 → 참여 → 종료
 *  (FR-030-01/03/04/09). The states and the order they are checked in:
 *  `docs/design/presence-and-focus.md`, "`FocusShare`'s states" — including
 *  why one presenter at a time is what ships, and what allowing several would
 *  take (issue #100). */
export function FocusShare({ memberId }: { memberId: string }) {
  const { members, isPresenting, setPresenting } = useWorkspacePresence();
  const { followingId, follow, unfollow } = useFocusFollow();
  const pathname = usePathname();

  // Sorted, so every client names the same presenter. Nothing stops two
  // members from presenting at once — `presenting` is a per-member flag and
  // this roster is a flat list — and `members.find(...)`, the shape this
  // replaces, resolved that by taking whichever one Yorkie's roster iteration
  // happened to yield first. That is not the same answer on two machines, so
  // two followers could be offered two different people, and neither could
  // tell there was a choice. One presenter is what the UI actually allows
  // (below), so the fix is to make the pick agree everywhere rather than to
  // surface a list nobody can reach: issue #100.
  const presenters = members
    .filter((m) => m.id !== memberId && m.presenting != null)
    .sort((a, b) => a.id.localeCompare(b.id));
  const following = followingId ? members.find((m) => m.id === followingId) : undefined;

  function startSharing() {
    const documentId = documentIdFromPathname(pathname);
    if (!documentId) return;

    // simple: read off the live DOM rather than threaded down through context
    // — needed once, at the click (`presence-and-focus.md`).
    const container = document.querySelector<HTMLElement>("[data-focus-scroll]");
    if (!container) return;

    const anchor = anchorAt(readBoxes(container), container.scrollTop);
    if (!anchor) return;

    setPresenting({ documentId, blockId: anchor.blockId, ratio: anchor.ratio });
  }

  if (isPresenting) {
    return (
      <button type="button" onClick={() => setPresenting(null)} className={`${BUTTON} bg-sky-deep text-white`}>
        공유 종료
      </button>
    );
  }

  if (following) {
    return (
      <button type="button" onClick={unfollow} className={`${BUTTON} bg-hover text-ink`}>
        <span aria-hidden className="size-1.5 rounded-full bg-sky-deep" />
        {following.nickname}님을 따라가는 중 · 종료
      </button>
    );
  }

  // `length > 0`, not `=== 1`: two members *can* both be presenting for the
  // moment it takes presence to settle, and this control must not fall through
  // to 공유하기 and invite a third when that happens.
  const [presenter] = presenters;
  if (presenter) {
    return (
      <button type="button" onClick={() => follow(presenter.id)} className={`${BUTTON} bg-sky-soft text-sky-text`}>
        <span
          aria-hidden
          style={{ backgroundColor: presenter.colorTag }}
          className="flex size-5 items-center justify-center rounded-full text-[10px] font-semibold text-white"
        >
          {presenter.nickname.slice(0, 1)}
        </span>
        {presenter.nickname}님이 공유 중 · 참여하기
      </button>
    );
  }

  // Hidden outside a document — there's no view to anchor a share to on the
  // dashboard, and there's only ever one other route shape to pop in and out
  // against, not the churn of many (`presence-and-focus.md`).
  const documentId = documentIdFromPathname(pathname);
  if (!documentId) return null;

  return (
    <button type="button" onClick={startSharing} className={`${BUTTON} text-ink-soft hover:bg-hover`}>
      {SHARE_ICON}
      공유하기
    </button>
  );
}
