"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Which input to mark, worked out from the status the server answered with. */
type FieldError = { field: "nickname" | "password" | null; message: string };

const FIELD_BY_STATUS: Record<number, FieldError["field"]> = {
  400: "nickname", // length cap, or a nickname that is only whitespace
  401: "password",
};

// The workspace dialogs' field look (`app/(workspace)/document-actions.tsx`),
// restated rather than imported: this route sits outside the workspace group.
const INPUT_BASE = "h-[38px] rounded-control border bg-elev px-3 text-[14.5px] font-normal text-ink outline-none";
const INPUT_OK = "border-line-strong focus:border-sky-deep focus:ring-3 focus:ring-sky-ring";
const INPUT_BAD = "border-danger ring-3 ring-danger-soft";
const LABEL = "flex flex-col gap-1.5 text-[13px] font-semibold text-ink-soft";

/** FR-020-01/02/05/08. Two fields and a button, and deliberately no password
 *  rules — the host chose the password and told it to the guest, so the only
 *  authority on whether it is right is the server. */
export function JoinForm() {
  const router = useRouter();
  const nicknameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  /** Where focus should land once the modal closes; the nickname if unset. */
  const focusOnClose = useRef<HTMLInputElement | null>(null);

  const [error, setError] = useState<FieldError | null>(null);
  const [pending, setPending] = useState(false);
  // The nickname waiting on the guest's answer, or null when nothing is asked.
  const [conflict, setConflict] = useState<string | null>(null);

  // `<dialog>` is modal only through `showModal()`, which has no declarative
  // equivalent. Focus is restored here because until `close()` runs the form is
  // inert — and `close()` hands focus back to the submit button itself.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (conflict !== null && !dialog.open) dialog.showModal();
    if (conflict === null && dialog.open) {
      dialog.close();
      (focusOnClose.current ?? nicknameRef.current)?.focus();
      focusOnClose.current = null;
    }
  }, [conflict]);

  /** Back out of a takeover — only while nothing is in flight. Once `join(true)`
   *  is sent the displacement has happened, and dismissing would sign the guest
   *  in under the name they backed out of. */
  function dismiss() {
    setConflict(null);
  }

  async function join(force: boolean) {
    const nickname = nicknameRef.current?.value ?? "";
    const password = passwordRef.current?.value ?? "";

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/workspace/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, password, force }),
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
        // FR-020-05: stay on the form so the guest can fix it in place. The
        // dialog has to close first — it is modal, so everything behind it is
        // inert: the error would render under the backdrop, and the focus call
        // below would land on an element the browser is ignoring.
        setError({ field, message: body.error ?? "입장하지 못했습니다." });
        // A null field is a network or capacity failure. Neither is the
        // password's fault, so focus stays where the guest left it.
        const target = field === "nickname" ? nicknameRef : field ? passwordRef : null;
        if (dialogRef.current?.open) {
          // The effect below moves focus once the modal is actually closed.
          focusOnClose.current = target?.current ?? null;
          setConflict(null);
        } else {
          target?.current?.focus();
        }
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
        onSubmit={(event) => {
          event.preventDefault();
          void join(false);
        }}
        className="flex w-full flex-col gap-[18px]"
      >
        <label className={LABEL}>
          닉네임
          <input
            ref={nicknameRef}
            required
            maxLength={20}
            autoComplete="nickname"
            autoFocus
            aria-invalid={error?.field === "nickname"}
            className={`${INPUT_BASE} ${error?.field === "nickname" ? INPUT_BAD : INPUT_OK}`}
          />
        </label>

        <label className={LABEL}>
          워크스페이스 비밀번호
          <input
            ref={passwordRef}
            type="password"
            required
            autoComplete="current-password"
            aria-invalid={error?.field === "password"}
            className={`${INPUT_BASE} ${error?.field === "password" ? INPUT_BAD : INPUT_OK}`}
          />
        </label>

        {error ? (
          <p role="alert" className="-mt-2.5 text-[13px] text-danger">
            {error.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-1 h-10 rounded-control bg-ink text-[14.5px] font-semibold text-paper hover:opacity-90 disabled:bg-hover disabled:text-ink-faint disabled:hover:opacity-100"
        >
          {pending ? "입장하는 중…" : "입장"}
        </button>
      </form>

      <dialog
        ref={dialogRef}
        onCancel={(event) => {
          // Esc means "I did not mean to displace anyone", not "go ahead".
          event.preventDefault();
          if (pending) return;
          dismiss();
        }}
        className="mx-auto mt-[18vh] w-full max-w-[400px] rounded-card bg-elev p-5 text-ink shadow-elev backdrop:bg-[rgba(10,14,20,0.36)]"
      >
        <h2 className="text-[17px] font-bold tracking-tight text-ink">이미 사용 중인 이름입니다</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
          <strong className="font-bold text-ink">{conflict}</strong>
          (으)로 접속 중인 기기가 있습니다. 계속하면 그 기기의 연결이 끊깁니다. 본인의 다른
          기기가 아니라면 다른 이름을 쓰세요.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={dismiss}
            className="h-[34px] rounded-control px-3.5 text-sm font-medium text-ink hover:bg-hover disabled:opacity-40"
          >
            다른 이름 쓰기
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void join(true)}
            className="h-[34px] rounded-control bg-ink px-3.5 text-sm font-semibold text-paper hover:opacity-90 disabled:opacity-70"
          >
            계속
          </button>
        </div>
      </dialog>
    </>
  );
}
