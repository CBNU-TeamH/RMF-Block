"use client";

import { usePathname } from "next/navigation";

import { anchorAt } from "@/lib/focus/anchor";
import { readBoxes } from "@/lib/focus/dom";
import { documentIdFromPathname } from "@/lib/focus/pathname";

import { useFocusFollow } from "./focus-follow-provider";
import { useWorkspacePresence } from "./presence-provider";

const BUTTON =
  "rounded-md border border-ink px-2.5 py-1 font-mono text-[11px] font-medium text-ink disabled:opacity-40";

/**
 * The one header control for UC-030's thin slice: 공유 → 참여 → 종료
 * (FR-030-01/03/04/09). Lives beside `PresenceStack` rather than as a toast —
 * see `docs/design/presence-and-focus.md`.
 *
 * Four states, checked in this order because they are mutually exclusive in
 * practice (you would not be following while also presenting):
 * I'm presenting → 종료 my own share; I'm following someone → 종료 that
 * follow; someone else is presenting and I'm not → 참여하기; otherwise →
 * 공유하기.
 */
export function FocusShare({ memberId }: { memberId: string }) {
  const { members, isPresenting, setPresenting } = useWorkspacePresence();
  const { followingId, follow, unfollow } = useFocusFollow();
  const pathname = usePathname();

  const presenter = members.find((m) => m.id !== memberId && m.presenting != null);
  const following = followingId ? members.find((m) => m.id === followingId) : undefined;

  function startSharing() {
    const documentId = documentIdFromPathname(pathname);
    if (!documentId) return;

    // simple: read straight off the live DOM rather than threading the
    // current anchor down through a context — this only ever needs it once,
    // at the moment of the click. A `null` here (the editor for this route
    // has not finished mounting yet) is rare and self-resolves: nothing
    // happens, and pressing the button again a moment later works.
    const container = document.querySelector<HTMLElement>("[data-focus-scroll]");
    if (!container) return;

    const anchor = anchorAt(readBoxes(container), container.scrollTop);
    if (!anchor) return;

    setPresenting({ documentId, blockId: anchor.blockId, ratio: anchor.ratio });
  }

  if (isPresenting) {
    return (
      <button type="button" onClick={() => setPresenting(null)} className={BUTTON}>
        공유 종료
      </button>
    );
  }

  if (following) {
    return (
      <button type="button" onClick={unfollow} className={BUTTON}>
        {following.nickname}님을 따라가는 중 · 종료
      </button>
    );
  }

  if (presenter) {
    return (
      <button type="button" onClick={() => follow(presenter.id)} className={BUTTON}>
        {presenter.nickname}님이 공유 중 · 참여하기
      </button>
    );
  }

  // Disabled outside a document, rather than hidden: FR-030-01's context is
  // "발표자가 바라보고 있는 문서로 시점을 고정시킨다" — there is no view to
  // anchor a share to on the document list or anywhere else in the shell.
  // Kept visible so the control does not pop in and out of the header on
  // every navigation.
  const documentId = documentIdFromPathname(pathname);
  return (
    <button
      type="button"
      onClick={startSharing}
      disabled={!documentId}
      title={documentId ? undefined : "문서를 열어야 공유할 수 있습니다."}
      className={BUTTON}
    >
      공유하기
    </button>
  );
}
