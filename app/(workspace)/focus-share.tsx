"use client";

import { usePathname } from "next/navigation";

import { anchorAt } from "@/lib/focus/anchor";
import { readBoxes } from "@/lib/focus/dom";
import { documentIdFromPathname } from "@/lib/focus/pathname";

import { useFocusFollow } from "./focus-follow-provider";
import { useWorkspacePresence } from "./presence-provider";

const BUTTON =
  "rounded-md border border-ink px-2.5 py-1 font-mono text-[11px] font-medium text-ink disabled:opacity-40";

/** The one header control for UC-030's thin slice: 공유 → 참여 → 종료
 *  (FR-030-01/03/04/09). The four states and the order they are checked in:
 *  `docs/design/presence-and-focus.md`, "`FocusShare`'s four states". */
export function FocusShare({ memberId }: { memberId: string }) {
  const { members, isPresenting, setPresenting } = useWorkspacePresence();
  const { followingId, follow, unfollow } = useFocusFollow();
  const pathname = usePathname();

  const presenter = members.find((m) => m.id !== memberId && m.presenting != null);
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

  // Disabled outside a document, not hidden (`presence-and-focus.md`).
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
