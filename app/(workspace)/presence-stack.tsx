"use client";

import { useMemo } from "react";

import { useWorkspacePresence } from "./presence-provider";

/** Four fits the artboard's top bar; past that the stack would push the
 * workspace name out of it. A workspace holds up to 64 members. */
const MAX_AVATARS = 4;

/**
 * Who else is here, as the artboard draws it: overlapping circles carrying an
 * initial, newest arrivals folded into a `+N`.
 *
 * The current user comes first — the same ordering Yorkie's own profile-stack
 * example uses — so the one avatar you can identify without hovering is yours.
 *
 * The name appears on hover, like that example's bubble, but through CSS rather
 * than click state: the label is always in the DOM, which is what a screen
 * reader reads, and `group-hover` is what makes it visible. `title` would have
 * been one attribute less, but its a-second-or-so delay is too slow for
 * something you glance at.
 */
/**
 * The name under an avatar. Always rendered so assistive technology has it;
 * `opacity` is the only thing hover changes, and `pointer-events-none` keeps it
 * from stealing the hover that reveals it.
 */
function NameLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute top-full left-1/2 z-10 mt-1.5 -translate-x-1/2 rounded border border-ink bg-paper px-1.5 py-0.5 font-mono text-[10px] font-medium whitespace-nowrap text-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
      {children}
    </span>
  );
}

export function PresenceStack({ memberId }: { memberId: string }) {
  const { status, members } = useWorkspacePresence();

  const ordered = useMemo(
    () => [...members].sort((a, b) => Number(b.id === memberId) - Number(a.id === memberId)),
    [members, memberId],
  );

  if (status === "connecting") {
    return (
      <span className="font-mono text-[11px] tracking-wide text-ink-faint">연결 중…</span>
    );
  }

  if (status === "failed") {
    return (
      <span
        title="Yorkie 서버에 연결할 수 없습니다. 문서 목록은 그대로 쓸 수 있고, 접속자 표시만 멈춥니다. 자세한 내용은 브라우저 콘솔을 보세요."
        className="flex items-center gap-1.5 font-mono text-[11px] tracking-wide text-ink-faint"
      >
        <span aria-hidden>❌</span>
        연결 끊김
      </span>
    );
  }

  const shown = ordered.slice(0, MAX_AVATARS);
  const hidden = ordered.slice(MAX_AVATARS);

  return (
    <div className="flex items-center gap-2.5">
      <span className="font-mono text-[11px] tracking-wide text-ink-faint">
        {ordered.length}명 접속 중
      </span>
      <ul className="flex items-center">
        {shown.map((member) => (
          <li
            key={member.id}
            style={{ backgroundColor: member.colorTag }}
            tabIndex={0}
            className="group relative -ml-1.5 flex size-6 items-center justify-center rounded-full border border-ink text-[11px] font-bold text-ink first:ml-0"
          >
            <span aria-hidden>{member.nickname.slice(0, 1)}</span>
            <NameLabel>
              {member.nickname}
              {member.id === memberId ? " (나)" : ""}
            </NameLabel>
          </li>
        ))}
        {hidden.length > 0 ? (
          <li tabIndex={0}
            className="group relative -ml-1.5 flex size-6 items-center justify-center rounded-full border border-ink bg-paper-2 font-mono text-[10px] font-bold text-ink-soft">
            <span aria-hidden>+{hidden.length}</span>
            <NameLabel>{hidden.map((member) => member.nickname).join(", ")}</NameLabel>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
