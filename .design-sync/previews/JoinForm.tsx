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
export function EntryScreen() {
  return (
    <AppShell pathname="/join">
      <main className="flex min-h-[360px] flex-col items-center justify-center gap-6 bg-shell px-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">TeamH 워크스페이스</h1>
        <JoinForm />
      </main>
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
      <main ref={ref} className="flex min-h-[360px] flex-col items-center justify-center gap-6 bg-shell px-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">TeamH 워크스페이스</h1>
        <JoinForm />
      </main>
    </AppShell>
  );
}
