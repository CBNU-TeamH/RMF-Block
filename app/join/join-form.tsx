"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Which input to mark, worked out from the status the server answered with. */
type FieldError = { field: "nickname" | "password" | null; message: string };

const FIELD_BY_STATUS: Record<number, FieldError["field"]> = {
  400: "nickname", // the only 400 a filled-in form can produce is the length cap
  401: "password",
};

const INPUT_BASE =
  "rounded-md border bg-white px-3 py-2 text-base text-black dark:bg-zinc-900 dark:text-zinc-50";
const INPUT_OK = "border-zinc-300 dark:border-zinc-700";
const INPUT_BAD = "border-red-500 dark:border-red-500";

/**
 * FR-020-01/02/05/08. Two fields and a button.
 *
 * There are deliberately no password rules here — no length, no strength, no
 * confirmation field. The host chose the password and told it to the guest, so
 * the only thing this form could check is whether they typed something, and the
 * only authority on whether it is right is the server (`lib/workspace-config.ts`).
 */
export function JoinForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const nicknameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [error, setError] = useState<FieldError | null>(null);
  const [pending, setPending] = useState(false);
  // The nickname waiting on the guest's answer, or null when nothing is asked.
  const [conflict, setConflict] = useState<string | null>(null);

  // `<dialog>` is only modal — backdrop, focus trap, Esc to dismiss — when it is
  // opened through showModal(), which has no declarative equivalent.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (conflict !== null && !dialog.open) dialog.showModal();
    if (conflict === null && dialog.open) dialog.close();
  }, [conflict]);

  async function join(force: boolean) {
    const form = formRef.current;
    if (!form) return;
    const values = new FormData(form);
    const nickname = String(values.get("nickname") ?? "");

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/workspace/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, password: values.get("password"), force }),
      });

      // Someone is still signed in under this nickname and joining would throw
      // them out (FR-020-08). Ask rather than do it silently.
      if (response.status === 409) {
        setConflict(nickname);
        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const field = FIELD_BY_STATUS[response.status] ?? null;
        // FR-020-05: stay on the form so the guest can fix it in place.
        setError({ field, message: body.error ?? "입장하지 못했습니다." });
        (field === "nickname" ? nicknameRef : passwordRef).current?.focus();
        return;
      }

      setConflict(null);
      // `refresh()` before `push()`: the home page is a server component that
      // reads the session cookie, and without this it can render from a cached
      // payload produced while the visitor was still signed out.
      router.refresh();
      router.push("/");
    } catch {
      setError({ field: null, message: "서버에 연결할 수 없습니다." });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          void join(false);
        }}
        className="flex w-full max-w-xs flex-col gap-3"
      >
        <label className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
          닉네임
          <input
            ref={nicknameRef}
            name="nickname"
            required
            maxLength={20}
            autoComplete="nickname"
            autoFocus
            aria-invalid={error?.field === "nickname"}
            className={`${INPUT_BASE} ${error?.field === "nickname" ? INPUT_BAD : INPUT_OK}`}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
          워크스페이스 비밀번호
          <input
            ref={passwordRef}
            name="password"
            type="password"
            required
            autoComplete="current-password"
            aria-invalid={error?.field === "password"}
            className={`${INPUT_BASE} ${error?.field === "password" ? INPUT_BAD : INPUT_OK}`}
          />
        </label>

        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-black px-3 py-2 text-base font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
        >
          {pending ? "입장하는 중…" : "입장"}
        </button>
      </form>

      <dialog
        ref={dialogRef}
        onCancel={(event) => {
          // Esc means "I did not mean to displace anyone", not "go ahead".
          event.preventDefault();
          setConflict(null);
          nicknameRef.current?.focus();
        }}
        className="m-auto max-w-sm rounded-lg bg-white p-5 text-black backdrop:bg-black/40 dark:bg-zinc-900 dark:text-zinc-50"
      >
        <h2 className="text-base font-semibold">이미 사용 중인 이름입니다</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          <strong className="font-medium text-black dark:text-zinc-50">{conflict}</strong>
          (으)로 접속 중인 기기가 있습니다. 계속하면 그 기기의 연결이 끊깁니다. 본인의 다른
          기기가 아니라면 다른 이름을 쓰세요.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setConflict(null);
              nicknameRef.current?.focus();
            }}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
          >
            다른 이름 쓰기
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void join(true)}
            className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
          >
            계속
          </button>
        </div>
      </dialog>
    </>
  );
}
