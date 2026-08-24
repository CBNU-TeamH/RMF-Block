import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { sessionRegistry } from "@/lib/auth/session-registry";
import { SESSION_COOKIE } from "@/lib/auth/types";
import { isHostSecret } from "@/lib/host-secret";

export default async function Home() {
  const jar = await cookies();
  const isHost = isHostSecret(jar.get("role")?.value);
  const member = sessionRegistry.resolve(jar.get(SESSION_COOKIE)?.value);

  // The workspace is password-gated (FR-020-03/04), so anyone without a session
  // goes to the join screen. The host is already proven by the bootstrap secret
  // and does not type the guest password.
  if (!isHost && !member) {
    redirect("/join");
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
        {member ? `hello ${member.nickname}!` : "hello host!"}
      </h1>
    </main>
  );
}
