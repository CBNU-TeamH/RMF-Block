"use client";

import { useEffect, useRef, useState } from "react";

import type { WorkspaceDocument } from "@/lib/documents/documents";
import { subtreeIds } from "@/lib/documents/tree";

/** Which of UC-023's three operations the dialog is standing in for. The
 *  document is carried rather than looked up by id: the catalogue can change
 *  under an open dialog (someone else's delete arrives on the socket), and the
 *  dialog should finish describing what it was opened for. */
export type DocumentAction =
  | { kind: "rename"; document: WorkspaceDocument }
  | { kind: "move"; document: WorkspaceDocument }
  | { kind: "delete"; document: WorkspaceDocument };

const INPUT_BASE = "rounded-md border bg-paper-2 px-3 py-2 text-base text-ink";
const INPUT_OK = "border-ink";
const INPUT_BAD = "border-red-600";
const ROOT = "__root__";

/**
 * Rename, move and delete for one document (FR-023-01~06).
 *
 * One dialog for three operations rather than three dialogs: they share the
 * whole shape — a modal, a pending flag, one error line from the server, and a
 * confirm button — and differ only in the field between the heading and the
 * buttons. Split apart, the three would be the same forty lines three times.
 *
 * Every one of them already has a server (`app/api/documents/[id]/route.ts`)
 * that validates, cascades and broadcasts. Nothing here re-decides any of that:
 * a name clash (FR-023-02) is the server's answer to render, not a check to
 * repeat, because the catalogue can gain a sibling between the keystroke and
 * the request. The one thing this file decides on its own is which parents to
 * *offer* for a move, since a list that offers an illegal target and then fails
 * is worse than one that never offers it.
 */
export function DocumentActionDialog({
  action,
  documents,
  onClose,
  onDone,
}: {
  action: DocumentAction | null;
  documents: Array<WorkspaceDocument>;
  onClose: () => void;
  /** The write landed. The socket already told every client, this browser
   *  included; this is for the server component behind the list. */
  onDone: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>(ROOT);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `<dialog>` is only modal through `showModal()`, which has no declarative
  // equivalent — the same reason `join-form.tsx` drives its dialog from an
  // effect rather than an `open` prop.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (action && !dialog.open) {
      setError(null);
      setPending(false);
      setName(action.document.name);
      setParentId(action.document.parentId ?? ROOT);
      dialog.showModal();
      // showModal() focuses the dialog; the field is what someone wants to type
      // in, and only rename has one worth landing in.
      if (action.kind === "rename") requestAnimationFrame(() => nameRef.current?.select());
    }
    if (!action && dialog.open) dialog.close();
  }, [action]);

  if (!action) return <dialog ref={dialogRef} />;

  const { document: target, kind } = action;

  /** Every document that could legally hold this one, plus the root. The
   *  document itself and its descendants are left out because moving into them
   *  would make it its own ancestor — `wouldCycle` refuses exactly this, and
   *  `subtreeIds` is what it asks. Offering a target the server will reject
   *  turns a UI mistake into an error message. */
  const forbidden = new Set(subtreeIds(documents, target.id));
  const destinations = documents.filter((candidate) => !forbidden.has(candidate.id));

  // FR-023-06: the count is the warning. "3개 문서가 함께 삭제됩니다" is a
  // different decision from "이 문서를 삭제합니다", and the person clicking is
  // the only one who can tell them apart.
  const descendants = subtreeIds(documents, target.id).length - 1;

  async function submit() {
    setPending(true);
    setError(null);

    try {
      const response =
        kind === "delete"
          ? await fetch(`/api/documents/${target.id}`, { method: "DELETE" })
          : await fetch(`/api/documents/${target.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              // Exactly one of the two, which is what the route requires: they
              // are operations with different collision rules and a request
              // carrying both would have to pick.
              body: JSON.stringify(
                kind === "rename" ? { name } : { parentId: parentId === ROOT ? null : parentId },
              ),
            });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(body.error ?? "요청을 처리하지 못했습니다.");
        if (kind === "rename") nameRef.current?.focus();
        return;
      }

      onDone();
      onClose();
    } catch {
      setError("서버에 연결할 수 없습니다.");
    } finally {
      setPending(false);
    }
  }

  const heading =
    kind === "rename"
      ? "문서 이름 변경"
      : kind === "move"
        ? `'${target.name}' 이동`
        : `'${target.name}' 삭제`;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
      className="m-auto max-w-sm rounded-lg border border-ink bg-paper p-5 text-ink backdrop:bg-ink/40"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="flex flex-col gap-3"
      >
        <h2 className="text-base font-bold text-ink">{heading}</h2>

        {kind === "rename" ? (
          <label className="flex flex-col gap-1 text-sm text-ink-soft">
            문서 이름
            <input
              ref={nameRef}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              aria-invalid={error !== null}
              className={`${INPUT_BASE} ${error ? INPUT_BAD : INPUT_OK}`}
            />
          </label>
        ) : null}

        {kind === "move" ? (
          <label className="flex flex-col gap-1 text-sm text-ink-soft">
            옮길 위치
            <select
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
              className={`${INPUT_BASE} ${error ? INPUT_BAD : INPUT_OK}`}
            >
              <option value={ROOT}>워크스페이스 최상위</option>
              {destinations.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {kind === "delete" ? (
          <p className="text-sm text-ink-soft">
            {descendants > 0
              ? `하위 문서 ${descendants}개도 함께 삭제됩니다. 되돌릴 수 없습니다.`
              : "되돌릴 수 없습니다."}
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        ) : null}

        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="rounded-md border border-ink px-3 py-1.5 text-sm text-ink disabled:opacity-40"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={pending}
            className={`rounded-md border px-3 py-1.5 text-sm font-bold disabled:opacity-40 ${
              kind === "delete"
                ? "border-red-600 bg-red-600 text-paper"
                : "border-sky-deep bg-sky text-ink"
            }`}
          >
            {pending ? "처리 중…" : kind === "rename" ? "이름 변경" : kind === "move" ? "이동" : "삭제"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
