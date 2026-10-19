"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { anchorAt } from "@/lib/focus/anchor";
import { readBoxes } from "@/lib/focus/dom";
import { documentIdFromPathname } from "@/lib/focus/pathname";

import { SHARE_ENDED_MS, SHARE_STARTED_MS, useFocusFollow, type Sharer } from "./focus-follow-provider";
import { useWorkspacePresence } from "./presence-provider";

/** 30px, radius 9 (`docs/ui/redesign/HANDOFF.md` §3); each state adds its colours. */
const BUTTON =
  "flex h-[30px] items-center gap-1.5 rounded-control px-2.5 text-[13.5px] font-medium disabled:opacity-40";
const SHARE_ICON = (
  <svg aria-hidden width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 10V2.5M5 5.5l3-3 3 3M3.5 9v4h9V9" />
  </svg>
);

/** The one header control for UC-030: 공유 → 참여 → 일시 정지 / 재개 → 종료
 *  (FR-030-01/03/04/08/09), and the cards announcing a share's start and end
 *  (FR-030-03/11). The states and the order they are checked in:
 *  `docs/design/presence-and-focus.md`, "`FocusShare`'s states" — including
 *  why one presenter at a time is what ships, and what allowing several would
 *  take (issue #100). */
export function FocusShare({ memberId }: { memberId: string }) {
  const { shareStarted, shareEnded, follow } = useFocusFollow();
  return (
    <>
      {shareStarted || shareEnded ? (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4">
          {shareStarted ? (
            <NoticeCard
              key={shareStarted.id}
              sharer={shareStarted}
              message="화면 공유를 시작했습니다"
              lasts={SHARE_STARTED_MS}
              action={
                <button
                  type="button"
                  onClick={() => follow(shareStarted.id)}
                  aria-label={`${shareStarted.nickname}님의 공유에 참여하기`}
                  className={`${BUTTON} flex-none bg-sky-soft text-sky-text`}
                >
                  참여하기
                </button>
              }
            />
          ) : null}
          {shareEnded ? <NoticeCard sharer={shareEnded} message="공유가 종료되었습니다" lasts={SHARE_ENDED_MS} /> : null}
        </div>
      ) : null}
      <FocusShareControl memberId={memberId} />
    </>
  );
}

const SLIDE_MS = 240;

/** A card that drops in from the top of the window and goes back up, like a
 *  phone's notification. Its owner unmounts it after `lasts`, so the way out
 *  starts `SLIDE_MS` before that. */
function NoticeCard({
  sharer,
  message,
  lasts,
  action,
}: {
  sharer: Sharer;
  message: string;
  lasts: number;
  action?: React.ReactNode;
}) {
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = card.current;
    // happy-dom has no `animate`; reduced motion just shows and hides it.
    if (!node?.animate || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const hidden = { transform: "translateY(-120%)", opacity: 0 };
    const shown = { transform: "translateY(0)", opacity: 1 };
    node.animate([hidden, shown], { duration: SLIDE_MS, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
    const leave = setTimeout(
      () => node.animate([shown, hidden], { duration: SLIDE_MS, easing: "ease-in", fill: "forwards" }),
      lasts - SLIDE_MS,
    );
    return () => clearTimeout(leave);
  }, [lasts]);

  return (
    <div
      ref={card}
      role="status"
      // Clickable only when there is something to click: the strip is clear underneath otherwise.
      className={`flex w-full max-w-[340px] items-center gap-3 rounded-card border border-line bg-elev px-3.5 py-2.5 shadow-elev ${
        action ? "pointer-events-auto" : ""
      }`}
    >
      <span
        aria-hidden
        style={{ backgroundColor: sharer.colorTag }}
        className="flex size-8 flex-none items-center justify-center rounded-full text-[13px] font-semibold text-white"
      >
        {sharer.nickname.slice(0, 1)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold text-ink">{sharer.nickname}</span>
        <span className="block text-[13px] text-ink-soft">{message}</span>
      </span>
      {action}
    </div>
  );
}

function FocusShareControl({ memberId }: { memberId: string }) {
  const { members, isPresenting, setPresenting } = useWorkspacePresence();
  const { followingId, pausedId, follow, unfollow, pause, resume } = useFocusFollow();
  const pathname = usePathname();

  // Sorted, so every client names the same presenter; two presenters are representable, issue #100.
  const presenters = members
    .filter((m) => m.id !== memberId && m.presenting != null)
    .sort((a, b) => a.id.localeCompare(b.id));
  const following = followingId ? members.find((m) => m.id === followingId) : undefined;
  const paused = pausedId ? members.find((m) => m.id === pausedId) : undefined;

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
      <span className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={unfollow}
          title="직접 스크롤하거나 편집하면 따라가기가 일시 정지됩니다"
          className={`${BUTTON} bg-hover text-ink`}
        >
          <span aria-hidden className="size-1.5 rounded-full bg-sky-deep" />
          {following.nickname}님을 따라가는 중 · 종료
        </button>
        <button type="button" onClick={pause} className={`${BUTTON} text-ink-soft hover:bg-hover`}>
          일시 정지
        </button>
      </span>
    );
  }

  // E3-1: the view is the follower's again until 재개 brings it back.
  if (paused) {
    return (
      <span className="flex items-center gap-0.5">
        <button type="button" onClick={resume} className={`${BUTTON} bg-sky-soft text-sky-text`}>
          {paused.nickname}님 따라가기 일시 정지됨 · 재개
        </button>
        <button type="button" onClick={unfollow} className={`${BUTTON} text-ink-soft hover:bg-hover`}>
          종료
        </button>
      </span>
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
