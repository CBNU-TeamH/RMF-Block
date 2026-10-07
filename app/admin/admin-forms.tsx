"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { WorkspaceMember } from "@/lib/auth/types";

import { CANCEL, DIALOG, DIALOG_TITLE, FIELD_LABEL, Spinner, confirmClass, inputClass } from "../(workspace)/ui";

/** One request, its pending flag and its error — the shape `join-form.tsx`
 *  handles by hand, shared by the three actions here. Each call site writes
 *  its own `fetch` with a literal URL and method, which is what lets
 *  `scripts/gen-endpoints.mjs` find it. */
function useRequest() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(request: () => Promise<Response>): Promise<boolean> {
    setPending(true);
    setError(null);
    try {
      const response = await request();
      if (response.ok) return true;
      const answer = await response.json().catch(() => ({}));
      setError(answer.error ?? "요청을 처리하지 못했습니다.");
      return false;
    } catch {
      setError("서버에 연결할 수 없습니다.");
      return false;
    } finally {
      setPending(false);
    }
  }

  return { pending, error, run };
}

const json = (body: unknown) => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const ErrorLine = ({ message }: { message: string | null }) =>
  message ? (
    <p role="alert" className="text-[13px] text-danger">
      {message}
    </p>
  ) : null;

/** UC-010's setup screen (FR-010-01/02). */
export function SetupForm() {
  const router = useRouter();
  const { pending, error, run } = useRequest();

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const body = { name: form.get("name"), password: form.get("password") };
        if (await run(() => fetch("/api/workspace", { method: "POST", ...json(body) }))) {
          router.refresh();
          router.push("/");
        } else {
          // Another tab may have opened it (409): re-render, and this page
          // becomes the manage view. A 400 re-renders as the same form, error kept.
          router.refresh();
        }
      }}
      className="flex flex-col gap-[18px]"
    >
      <label className={FIELD_LABEL}>
        워크스페이스 이름
        <input name="name" maxLength={40} placeholder="RMF Block" autoFocus className={inputClass(false)} />
      </label>
      <label className={FIELD_LABEL}>
        접속 비밀번호
        <input name="password" type="password" required minLength={4} autoComplete="new-password" className={inputClass(error !== null)} />
      </label>
      <ErrorLine message={error} />
      <button type="submit" disabled={pending} className={`${confirmClass(false)} justify-center`}>
        {pending ? <Spinner /> : null}
        워크스페이스 열기
      </button>
    </form>
  );
}

/** UC-011 E1: connected users keep their sessions (FR-011-05). */
export function PasswordForm() {
  const { pending, error, run } = useRequest();
  const [done, setDone] = useState(false);

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const input = event.currentTarget.elements.namedItem("password") as HTMLInputElement;
        setDone(false);
        if (await run(() => fetch("/api/workspace/password", { method: "PATCH", ...json({ password: input.value }) }))) {
          input.value = "";
          setDone(true);
        }
      }}
      className="flex flex-col gap-3"
    >
      <label className={FIELD_LABEL}>
        새 비밀번호
        <input name="password" type="password" required minLength={4} autoComplete="new-password" className={inputClass(error !== null)} />
      </label>
      <ErrorLine message={error} />
      {done ? (
        <p role="status" className="text-[13px] text-ink-soft">
          비밀번호를 바꿨습니다. 접속 중인 사람은 그대로이고, 새로 들어오는 사람부터 새 비밀번호가 필요합니다.
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={`${confirmClass(false)} self-start`}>
        {pending ? <Spinner /> : null}
        비밀번호 변경
      </button>
    </form>
  );
}

/** FR-011-01~03: the connected guests, each kicked only after a confirmation. */
export function GuestList({ guests }: { guests: Array<WorkspaceMember> }) {
  const router = useRouter();
  const { pending, error, run } = useRequest();
  const [target, setTarget] = useState<WorkspaceMember | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // `showModal()` has no declarative equivalent — the same effect `join-form.tsx` uses.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (target && !dialog.open) dialog.showModal();
    if (!target && dialog.open) dialog.close();
  }, [target]);

  if (guests.length === 0) {
    return <p className="text-[13px] text-ink-faint">접속 중인 게스트가 없습니다.</p>;
  }

  return (
    <>
      <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
        {guests.map((guest) => (
          <li key={guest.id} className="flex items-center gap-2.5 px-3 py-2">
            <span aria-hidden style={{ backgroundColor: guest.colorTag }} className="size-3 rounded-full" />
            <span className="flex-1 truncate text-ink">{guest.nickname}</span>
            <button type="button" onClick={() => setTarget(guest)} className="h-[30px] rounded-control px-2.5 text-[13px] font-medium text-danger hover:bg-hover">
              퇴장
            </button>
          </li>
        ))}
      </ul>

      <dialog ref={dialogRef} onClose={() => setTarget(null)} className={DIALOG}>
        <div className="flex flex-col gap-4">
          <h2 className={DIALOG_TITLE}>{target?.nickname}님을 퇴장시킬까요?</h2>
          <p className="text-[14px] text-ink-soft">
            접속이 바로 끊깁니다. 차단은 아니어서, 비밀번호를 알면 다시 들어올 수 있습니다.
          </p>
          <ErrorLine message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" disabled={pending} onClick={() => setTarget(null)} className={CANCEL}>
              취소
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                if (target && (await run(() => fetch(`/api/workspace/members/${target.id}`, { method: "DELETE" })))) {
                  setTarget(null);
                  router.refresh();
                }
              }}
              className={confirmClass(true)}
            >
              {pending ? <Spinner /> : null}
              퇴장
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
