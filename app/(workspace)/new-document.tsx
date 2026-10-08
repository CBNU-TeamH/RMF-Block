"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useRef, useState } from "react";

import { CANCEL, DIALOG, DIALOG_TITLE, FIELD_LABEL, Spinner, confirmClass, inputClass } from "./ui";

/** The document a new one goes inside, or `null` for the root (UC-021 E1a). Its
 *  name comes from the caller — the tree's socket-fresh list — for the title. */
type Parent = { id: string; name: string } | null;

/** Opens the 새 문서 dialog. */
const NewDocumentContext = createContext<(parent: Parent) => void>(() => undefined);

export const useNewDocument = () => useContext(NewDocumentContext);

/**
 * Where UC-021's 기본 흐름 starts: a `<dialog>` for the one thing it asks for
 * before creating a document — a name — the same `showModal()`-only-for-real-
 * modality pattern `join-form.tsx` already uses. In the layout rather than the
 * sidebar tree because the tree, the collapsed rail and an empty workspace's
 * main area all open it (#168).
 */
export function NewDocumentProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  // Held in state rather than passed to `create()` because the dialog sits
  // between the click and the request.
  const [parent, setParent] = useState<Parent>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable, so typing a name does not re-render every caller through the context.
  const open = useCallback((under: Parent) => {
    setParent(under);
    setName("");
    setError(null);
    dialogRef.current?.showModal();
    // showModal() moves focus to the dialog itself; the name field is what a
    // person actually wants to type into.
    requestAnimationFrame(() => nameRef.current?.focus());
  }, []);

  async function create() {
    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId: parent?.id ?? null }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(body.error ?? "문서를 만들지 못했습니다.");
        nameRef.current?.focus();
        return;
      }

      dialogRef.current?.close();
      // The layout is a server component reading `readDocuments()` fresh per
      // request; refresh() re-seeds the tree without a full reload.
      router.refresh();
      router.push(`/documents/${body.document.id}`);
    } catch {
      setError("서버에 연결할 수 없습니다.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <NewDocumentContext.Provider value={open}>
      {children}

      <dialog
        ref={dialogRef}
        onCancel={(event) => {
          if (creating) event.preventDefault();
        }}
        className={DIALOG}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
          className="flex flex-col gap-4"
        >
          <h2 className={DIALOG_TITLE}>
            {parent === null ? "새 문서" : `'${parent.name}' 아래에 새 문서`}
          </h2>
          <label className={FIELD_LABEL}>
            문서 이름
            <input
              ref={nameRef}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              aria-invalid={error !== null}
              className={inputClass(error !== null)}
            />
          </label>

          {error ? (
            <p role="alert" className="-mt-2 text-[13px] text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={creating}
              onClick={() => dialogRef.current?.close()}
              className={CANCEL}
            >
              취소
            </button>
            <button type="submit" disabled={creating} className={confirmClass(false)}>
              {creating ? <Spinner /> : null}
              {creating ? "만드는 중…" : "만들기"}
            </button>
          </div>
        </form>
      </dialog>
    </NewDocumentContext.Provider>
  );
}
