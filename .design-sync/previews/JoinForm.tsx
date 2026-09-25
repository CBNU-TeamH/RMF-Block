import { useEffect, useRef } from "react";
import { AppShell, JoinForm } from "rmf-block";

// The form posts to the app server. Answer the join route so the error state
// can be shown: a wrong workspace password comes back as a 401.
const realFetch = window.fetch.bind(window);
window.fetch = (input, init) =>
  String(input).endsWith("/api/workspace/join")
    ? Promise.resolve(new Response(JSON.stringify({ error: "비밀번호가 올바르지 않습니다." }), { status: 401 }))
    : realFetch(input, init);

/** The guest entry screen as `app/join/page.tsx` lays it out. */
function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[440px] items-center justify-center bg-paper p-6">
      <div className="flex w-full max-w-[380px] flex-col gap-7">
        <div className="flex flex-col gap-3.5">
          <span className="flex size-9 items-center justify-center rounded-card bg-ink text-[17px] font-bold text-paper">r</span>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-ink">TeamH 워크스페이스에 참여</h1>
            <p className="leading-relaxed text-ink-soft">같은 네트워크의 팀원과 문서를 실시간으로 함께 편집합니다.</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EntryScreen() {
  return (
    <AppShell pathname="/join">
      <Screen>
        <JoinForm />
      </Screen>
    </AppShell>
  );
}

/** Filled in and submitted with the wrong password: the field turns red and the
 *  server's message shows under it. */
export function WrongPassword() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const [nickname, password] = Array.from(ref.current?.querySelectorAll("input") ?? []);
    if (!nickname || !password) return;
    nickname.value = "김민지";
    password.value = "wrong-pass";
    ref.current?.querySelector("form")?.requestSubmit();
  }, []);
  return (
    <AppShell pathname="/join">
      <main ref={ref}>
        <Screen>
          <JoinForm />
        </Screen>
      </main>
    </AppShell>
  );
}
