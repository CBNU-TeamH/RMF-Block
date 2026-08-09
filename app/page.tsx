import { cookies } from "next/headers";

import { isHostSecret } from "@/lib/host-secret";

export default async function Home() {
  const isHost = isHostSecret((await cookies()).get("role")?.value);

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
        {isHost ? "hello host!" : "hello guest!"}
      </h1>
    </main>
  );
}
