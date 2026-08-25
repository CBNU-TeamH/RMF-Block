"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * FR-020-01/02/05. Two fields and a button.
 *
 * There are deliberately no password rules here — no length, no strength, no
 * confirmation field. The host chose the password and told it to the guest, so
 * the only thing this form could check is whether they typed something, and the
 * only authority on whether it is right is the server (`lib/workspace-config.ts`).
 */
export function JoinForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/workspace/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: form.get("nickname"),
          password: form.get("password"),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        // FR-020-05: stay on the form so the guest can retry.
        setError(body.error ?? "Could not join the workspace.");
        return;
      }

      // `refresh()` before `push()`: the home page is a server component that
      // reads the session cookie, and without this it can render from a cached
      // payload produced while the visitor was still signed out.
      router.refresh();
      router.push("/");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-xs flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
        Nickname
        <input
          name="nickname"
          required
          maxLength={20}
          autoComplete="nickname"
          autoFocus
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
        Workspace password
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-3 py-2 text-base font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
      >
        {pending ? "Joining…" : "Join"}
      </button>
    </form>
  );
}
