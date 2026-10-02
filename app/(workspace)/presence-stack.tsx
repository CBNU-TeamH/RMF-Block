"use client";

import { useMemo } from "react";

import { Avatar } from "./presence-avatar";
import { useWorkspacePresence } from "./presence-provider";

/** Four fits the artboard's top bar; past that the stack would push the
 * workspace name out of it. A workspace holds up to 64 members. */
const MAX_AVATARS = 4;

/** Who else is here, as the artboard draws it — overlapping circles, newest
 *  folded into a `+N`, the current user first so the one avatar you can identify
 *  without hovering is yours. The name is always in the DOM (which is what a
 *  screen reader reads) and revealed by `group-hover`; `title` would be one
 *  attribute less but its delay is too slow for something you glance at. */
export function PresenceStack({ memberId }: { memberId: string }) {
  const { status, members } = useWorkspacePresence();

  const ordered = useMemo(
    () => [...members].sort((a, b) => Number(b.id === memberId) - Number(a.id === memberId)),
    [members, memberId],
  );

  if (status === "connecting") {
    return (
      <span className="text-[13px] text-ink-faint">연결 중…</span>
    );
  }

  if (status === "failed") {
    return (
      <span
        title="Yorkie 서버에 연결할 수 없습니다. 문서 목록은 그대로 쓸 수 있고, 접속자 표시만 멈춥니다. 자세한 내용은 브라우저 콘솔을 보세요."
        className="flex items-center gap-1.5 text-[13px] text-ink-faint"
      >
        <span aria-hidden>❌</span>
        연결 끊김
      </span>
    );
  }

  const shown = ordered.slice(0, MAX_AVATARS);
  const hidden = ordered.slice(MAX_AVATARS);

  return (
    <div className="flex items-center gap-2 pr-1.5">
      <span className="sr-only">{ordered.length}명 접속 중</span>
      <ul className="flex items-center">
        {shown.map((member) => (
          <li key={member.id} className="-ml-1.5 rounded-full shadow-[0_0_0_2px_var(--color-paper)] first:ml-0">
            <Avatar
              colorTag={member.colorTag}
              label={member.nickname.slice(0, 1)}
              name={
                <>
                  {member.nickname}
                  {member.id === memberId ? " (나)" : ""}
                </>
              }
            />
          </li>
        ))}
        {hidden.length > 0 ? (
          <li tabIndex={0}
            className="group/avatar relative -ml-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-paper-2 px-1.5 text-[11px] font-semibold text-ink-soft shadow-[0_0_0_2px_var(--color-paper)] outline-none focus-visible:ring-2 focus-visible:ring-sky-deep">
            <span aria-hidden>+{hidden.length}</span>
            <span className="pointer-events-none absolute top-full left-1/2 z-10 mt-1.5 -translate-x-1/2 rounded-md bg-ink px-2 py-1 text-xs font-medium whitespace-nowrap text-paper opacity-0 transition-opacity duration-[120ms] group-hover/avatar:opacity-100 group-focus-visible/avatar:opacity-100">
              {hidden.map((member) => member.nickname).join(", ")}
            </span>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
