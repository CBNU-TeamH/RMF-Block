"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { WorkspaceDocument } from "@/lib/documents/documents";
import { subtreeIds } from "@/lib/documents/tree";
import { documentIdFromPathname } from "@/lib/focus/pathname";

import { DocumentRowMenu } from "./document-row-menu";
import { CANCEL, DIALOG, DIALOG_TITLE, Spinner, confirmClass, icon } from "./ui";

/** The dialog's two jobs: the sub-page question (FR-022-16), or why an export failed. */
type Prompt = { kind: "subpages"; count: number } | { kind: "error"; message: string };

/** How long a downloaded export's object URL is kept: the browser may still be
 *  reading it after `click()` returns. */
const REVOKE_AFTER_MS = 10_000;

/**
 * The open document's ··· menu at the end of the document bar: Markdown, and
 * PDF through the browser's print dialog (FR-022-15~17,
 * `docs/design/document-export.md`). Rendered by the layout beside the
 * breadcrumb, reading the same catalogue — it needs no more than the id.
 */
export function DocumentExport({ documents }: { documents: Array<WorkspaceDocument> }) {
  const currentId = documentIdFromPathname(usePathname());
  const target = documents.find((document) => document.id === currentId);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [pending, setPending] = useState<"only" | "all" | null>(null);

  // `showModal()` has no declarative form — `document-actions.tsx` says the same.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (prompt && dialog && !dialog.open) dialog.showModal();
    if (!prompt && dialog?.open) dialog.close();
  }, [prompt]);

  if (!target) return null;

  const download = async (includeSubpages: boolean) => {
    setPending(includeSubpages ? "all" : "only");
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(target.id)}/export?subpages=${includeSubpages ? 1 : 0}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setPrompt({ kind: "error", message: body.error ?? "문서를 내보내지 못했습니다." });
        return;
      }
      // Through a blob rather than a plain link, so a failure is a message here
      // instead of an error page in place of the editor.
      const url = URL.createObjectURL(await response.blob());
      const link = window.document.createElement("a");
      link.href = url;
      link.download = fileNameOf(response.headers.get("Content-Disposition")) ?? target.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
      setPrompt(null);
    } catch {
      setPrompt({ kind: "error", message: "서버에 연결할 수 없습니다." });
    } finally {
      setPending(null);
    }
  };

  return (
    <>
      <DocumentRowMenu
        label="문서 내보내기"
        items={[
          {
            label: "Markdown (.md)",
            icon: icon(<path d="M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10" />),
            onSelect: () => {
              const count = subtreeIds(documents, target.id).length - 1;
              if (count > 0) setPrompt({ kind: "subpages", count });
              else void download(false);
            },
          },
          {
            label: "PDF로 인쇄",
            icon: icon(<path d="M4.5 6V2.5h7V6M4.5 11.5h-2v-5h11v5h-2M4.5 9.5h7v4h-7z" />),
            onSelect: () => window.print(),
          },
        ]}
      />
      <dialog
        ref={dialogRef}
        onClose={() => setPrompt(null)}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        className={DIALOG}
      >
        {prompt?.kind === "subpages" ? (
          <div className="flex flex-col gap-4">
            <h2 className={DIALOG_TITLE}>&apos;{target.name}&apos; 내보내기</h2>
            <p className="-mt-2 text-sm leading-relaxed text-ink-soft">
              하위 문서 {prompt.count}개도 함께 내보낼까요? 포함하면 문서 구조대로 폴더에 담긴 .zip 파일로 내려받습니다.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" disabled={pending !== null} onClick={() => void download(false)} className={CANCEL}>
                {pending === "only" ? "내보내는 중…" : "이 문서만"}
              </button>
              <button type="button" disabled={pending !== null} onClick={() => void download(true)} className={confirmClass(false)}>
                {pending === "all" ? <Spinner /> : null}
                {pending === "all" ? "내보내는 중…" : "하위 문서 포함"}
              </button>
            </div>
          </div>
        ) : null}
        {prompt?.kind === "error" ? (
          <div className="flex flex-col gap-4">
            <h2 className={DIALOG_TITLE}>내보내지 못했습니다</h2>
            <p role="alert" className="-mt-2 text-sm text-danger">
              {prompt.message}
            </p>
            <div className="flex justify-end">
              <button type="button" onClick={() => setPrompt(null)} className={CANCEL}>
                닫기
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}

/** The name `attachmentHeaders` (`lib/files/serving.ts`) wrote into `filename*`. */
function fileNameOf(disposition: string | null): string | null {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/)?.[1];
  return encoded ? decodeURIComponent(encoded) : null;
}
