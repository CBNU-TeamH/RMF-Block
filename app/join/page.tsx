import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { sessionRegistry } from "@/lib/auth/session-registry";
import { SESSION_COOKIE } from "@/lib/auth/types";
import { isHostSecret } from "@/lib/host-secret";
import { getWorkspaceName, isWorkspaceOpen } from "@/lib/workspace-config";

import { JoinForm } from "./join-form";

/** FR-020-01: the join screen names the workspace the guest is entering. */
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const jar = await cookies();

  // Already inside — sending them back to the form would be a dead end they
  // could only escape by joining again.
  if (
    isHostSecret(jar.get("role")?.value) ||
    sessionRegistry.resolve(jar.get(SESSION_COOKIE)?.value)
  ) {
    redirect("/");
  }

  const { reason } = await searchParams;
  const open = isWorkspaceOpen();

  return (
    <main className="flex flex-1 items-center justify-center overflow-auto bg-paper p-6">
      <div className="flex w-full max-w-[380px] flex-col gap-7">
        <div className="flex flex-col gap-3.5">
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-card bg-ink text-[17px] font-bold text-paper"
          >
            r
          </span>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-ink">{getWorkspaceName()}에 참여</h1>
            <p className="leading-relaxed text-ink-soft">같은 네트워크의 팀원과 문서를 실시간으로 함께 편집합니다.</p>
          </div>
        </div>
        {reason === "kicked" ? (
          <p role="status" className="rounded-control bg-paper-2 px-3 py-2 text-[13.5px] text-ink">
            워크스페이스에서 퇴장되었습니다.
          </p>
        ) : null}
        {/* UC-010: nothing to join until the host has set a password. */}
        {open ? (
          <JoinForm />
        ) : (
          <p className="text-[14px] text-ink-soft">호스트가 아직 워크스페이스를 열지 않았습니다. 잠시 후 다시 시도해 주세요.</p>
        )}
      </div>
    </main>
  );
}
