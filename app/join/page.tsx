import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { sessionRegistry } from "@/lib/auth/session-registry";
import { SESSION_COOKIE } from "@/lib/auth/types";
import { isHostSecret } from "@/lib/host-secret";
import { getWorkspaceName } from "@/lib/workspace-config";

import { JoinForm } from "./join-form";

/** FR-020-01: the join screen names the workspace the guest is entering. */
export default async function JoinPage() {
  const jar = await cookies();

  // Already inside — sending them back to the form would be a dead end they
  // could only escape by joining again.
  if (
    isHostSecret(jar.get("role")?.value) ||
    sessionRegistry.resolve(jar.get(SESSION_COOKIE)?.value)
  ) {
    redirect("/");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-shell px-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink">
        {getWorkspaceName()}
      </h1>
      <JoinForm />
    </main>
  );
}
