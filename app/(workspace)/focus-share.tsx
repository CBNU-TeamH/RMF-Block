"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

import { anchorAt } from "@/lib/focus/anchor";
import { readBoxes } from "@/lib/focus/dom";
import { documentIdFromPathname } from "@/lib/focus/pathname";

import { useFocusFollow } from "./focus-follow-provider";
import { useWorkspacePresence } from "./presence-provider";

const BUTTON =
  "rounded-md border border-ink px-2.5 py-1 font-mono text-[11px] font-medium text-ink disabled:opacity-40";

/** The one header control for UC-030's thin slice: 공유 → 참여 → 종료
 *  (FR-030-01/03/04/09). The states and the order they are checked in:
 *  `docs/design/presence-and-focus.md`, "`FocusShare`'s states" — including
 *  why more than one simultaneous presenter needs a dropdown rather than
 *  picking just one and leaving the rest undiscoverable. */
export function FocusShare({ memberId }: { memberId: string }) {
  const { members, isPresenting, setPresenting } = useWorkspacePresence();
  const { followingId, follow, unfollow } = useFocusFollow();
  const pathname = usePathname();
  // Which simultaneous presenter the dropdown points at — only read once
  // `presenters.length > 1`. Settled during render below, the same way
  // `focus-follow-provider.tsx` settles `followingId`: a presenter this was
  // pointed at ending their share falls back to whoever's left, rather than
  // holding a stale id an effect would be needed to notice.
  const [pickedId, setPickedId] = useState<string | null>(null);

  const presenters = members.filter((m) => m.id !== memberId && m.presenting != null);
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

  if (presenters.length === 1) {
    const presenter = presenters[0];
    return (
      <button type="button" onClick={() => follow(presenter.id)} className={BUTTON}>
        {presenter.nickname}님이 공유 중 · 참여하기
      </button>
    );
  }

  if (presenters.length > 1) {
    const selected = presenters.find((p) => p.id === pickedId) ?? presenters[0];
    return (
      <span className="flex items-center gap-1">
        <select
          value={selected.id}
          onChange={(event) => setPickedId(event.target.value)}
          aria-label="참여할 발표자 선택"
          className="rounded-md border border-ink bg-paper px-1.5 py-1 font-mono text-[11px] font-medium text-ink"
        >
          {presenters.map((presenter) => (
            <option key={presenter.id} value={presenter.id}>
              {presenter.nickname}님이 공유 중
            </option>
          ))}
        </select>
        <button type="button" onClick={() => follow(selected.id)} className={BUTTON}>
          참여하기
        </button>
      </span>
    );
  }

  // Hidden outside a document — there's no view to anchor a share to on the
  // dashboard, and there's only ever one other route shape to pop in and out
  // against, not the churn of many (`presence-and-focus.md`).
  const documentId = documentIdFromPathname(pathname);
  if (!documentId) return null;

  return (
    <button type="button" onClick={startSharing} className={BUTTON}>
      공유하기
    </button>
  );
}
