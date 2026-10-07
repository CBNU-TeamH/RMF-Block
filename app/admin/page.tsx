import Link from "next/link";
import { redirect } from "next/navigation";

import { sessionRegistry } from "@/lib/auth/session-registry";
import { isHost } from "@/lib/auth/current-member";
import { getWorkspaceName, isWorkspaceOpen } from "@/lib/workspace-config";

import { AdminIcon } from "../(workspace)/ui";
import { GuestList, PasswordForm, SetupForm } from "./admin-forms";

/** The host's page (UC-010/UC-011): the setup screen until the workspace is
 *  open, then password change and the connected guests. Outside the
 *  `(workspace)` shell, like `/join` — before setup there is no workspace to
 *  frame. A guest is sent home, not shown a refusal. */
export default async function AdminPage() {
  if (!(await isHost())) redirect("/");

  const open = isWorkspaceOpen();

  return (
    <main className="flex flex-1 justify-center overflow-auto bg-paper p-6">
      <div className="flex w-full max-w-[440px] flex-col gap-8 pt-[8vh]">
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 self-start rounded-control border border-line-strong px-2 py-0.5 text-[12px] font-semibold tracking-wide text-ink-soft">
            <AdminIcon size={13} />
            ADMIN · 호스트 전용
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            {open ? `${getWorkspaceName()} 관리` : "워크스페이스 열기"}
          </h1>
          <p className="leading-relaxed text-ink-soft">
            {open
              ? "호스트만 볼 수 있는 화면입니다."
              : "이름과 접속 비밀번호를 정하면 게스트가 참여할 수 있습니다. 비밀번호는 게스트에게 직접 알려 주세요."}
          </p>
        </div>

        {open ? (
          <>
            <section className="flex flex-col gap-3">
              <h2 className="text-[15px] font-semibold text-ink">접속 비밀번호</h2>
              <PasswordForm />
            </section>
            <section className="flex flex-col gap-3">
              <h2 className="text-[15px] font-semibold text-ink">접속 중인 게스트</h2>
              <GuestList guests={sessionRegistry.liveMembers()} />
            </section>
            <Link href="/" className="self-start text-[13px] font-medium text-ink-soft hover:text-ink">
              ← 워크스페이스로
            </Link>
          </>
        ) : (
          <SetupForm />
        )}
      </div>
    </main>
  );
}
