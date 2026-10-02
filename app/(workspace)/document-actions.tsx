"use client";

import { useEffect, useRef, useState } from "react";

import type { WorkspaceDocument } from "@/lib/documents/documents";
import { subtreeIds } from "@/lib/documents/tree";

import { CANCEL, DIALOG, DIALOG_TITLE, FIELD_LABEL, Spinner, confirmClass, inputClass } from "./ui";

/** Which of UC-023's three operations the dialog is standing in for. The
 *  document is carried rather than looked up by id: the catalogue can change
 *  under an open dialog (someone else's delete arrives on the socket), and the
 *  dialog should finish describing what it was opened for. */
export type DocumentAction =
  | { kind: "rename"; document: WorkspaceDocument }
  | { kind: "move"; document: WorkspaceDocument }
  | { kind: "delete"; document: WorkspaceDocument };

const ROOT = "__root__";
const CONFIRM_LABEL = { rename: "이름 변경", move: "이동", delete: "삭제" } as const;

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
      className={DIALOG}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="flex flex-col gap-4"
      >
        <h2 className={DIALOG_TITLE}>{heading}</h2>

        {kind === "rename" ? (
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
        ) : null}

        {kind === "move" ? (
          <label className={FIELD_LABEL}>
            옮길 위치
            <select
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
              className={inputClass(error !== null)}
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
          <p className="-mt-2 text-sm leading-relaxed text-ink-soft">
            {descendants > 0
              ? `하위 문서 ${descendants}개도 함께 삭제됩니다. 되돌릴 수 없습니다.`
              : "되돌릴 수 없습니다."}
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="-mt-2 text-[13px] text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button type="button" disabled={pending} onClick={onClose} className={CANCEL}>
            취소
          </button>
          <button type="submit" disabled={pending} className={confirmClass(kind === "delete")}>
            {pending ? <Spinner /> : null}
            {pending ? (kind === "delete" ? "삭제 중…" : "처리 중…") : CONFIRM_LABEL[kind]}
          </button>
        </div>
      </form>
    </dialog>
  );
}
