"use client";

import { useCallback, useEffect, useState } from "react";

import { KINDS, type AttachmentKind } from "@/lib/chat/attachments";
import { isInlineType } from "@/lib/files/serving";
import { readableSize } from "@/lib/files/size";
import type { WorkspaceFile } from "@/lib/files/workspace-files";

import { useOpenChatAt } from "../chat-window";
import { FilePreviewDialog, type PreviewFile } from "../file-preview-dialog";
import { useFocusFollow } from "../focus-follow-provider";
import { FileIcon, Spinner } from "../ui";

/** UC-050: the workspace's files by type, and where each came from. Why the
 *  page looks like this and lists chat files too: `docs/design/file-manager.md`. */

const LABEL: Record<AttachmentKind, string> = { image: "이미지", pdf: "PDF", document: "기타" };

const day = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  // Pinned for the same reason `chat-message.tsx` pins its own.
  timeZone: "Asia/Seoul",
});

const ACTION = "rounded-control px-1.5 py-0.5 text-xs text-ink-soft hover:bg-paper-2 hover:text-ink";

type Listing = { files: Array<WorkspaceFile>; documentsUnavailable: boolean };

export function FileManager() {
  const [listing, setListing] = useState<Listing | null>(null);
  const [failed, setFailed] = useState(false);
  const [kind, setKind] = useState<AttachmentKind>("image");
  const [previewing, setPreviewing] = useState<PreviewFile | null>(null);
  const { goToBlock } = useFocusFollow();
  const openChatAt = useOpenChatAt();

  const load = useCallback(() => {
    fetch("/api/files")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((next: Listing) => {
        setListing(next);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);
  useEffect(() => load(), [load]);

  const closePreview = useCallback(() => setPreviewing(null), []);

  const retry = () => {
    setListing(null);
    setFailed(false);
    load();
  };

  const files = listing?.files.filter((file) => file.kind === kind) ?? [];

  return (
    <div className="h-full overflow-y-auto bg-paper">
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 pt-[6vh] pb-10">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-ink">파일</h1>
          <p className="leading-relaxed text-ink-soft">문서와 채팅에 올라온 파일을 한곳에서 봅니다.</p>
        </div>

        {failed ? (
          <p role="alert" className="flex items-center gap-2 text-[13.5px] text-danger">
            파일 목록을 불러오지 못했습니다.
            <button type="button" onClick={retry} className={ACTION}>
              다시 시도
            </button>
          </p>
        ) : listing === null ? (
          <span className="flex items-center gap-2 text-[13px] text-ink-faint">
            <Spinner /> 불러오는 중…
          </span>
        ) : (
          <>
            {listing.documentsUnavailable ? (
              <p role="status" className="flex items-center gap-2 rounded-control bg-paper-2 px-3 py-2 text-[13px] text-ink-soft">
                문서에 들어 있는 파일을 불러오지 못해 채팅 파일만 보입니다.
                <button type="button" onClick={retry} className={ACTION}>
                  다시 시도
                </button>
              </p>
            ) : null}

            <div role="group" aria-label="파일 종류" className="flex gap-1">
              {KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={k === kind}
                  onClick={() => setKind(k)}
                  className={`rounded-control px-2.5 py-1 text-[13px] font-medium ${
                    k === kind ? "bg-sky-soft text-sky-text" : "text-ink-soft hover:bg-hover"
                  }`}
                >
                  {LABEL[k]} {listing.files.filter((file) => file.kind === k).length}
                </button>
              ))}
            </div>

            {files.length === 0 ? (
              <p className="pt-8 text-center text-[13px] text-ink-faint">{LABEL[kind]} 파일이 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] table-fixed text-left text-[13.5px]">
                  <thead className="text-xs text-ink-faint">
                    <tr className="border-b border-line">
                      <th className="py-2 pl-2 font-medium">이름</th>
                      <th className="w-[20%] py-2 font-medium">출처</th>
                      <th className="w-[9%] py-2 font-medium">크기</th>
                      <th className="w-[11%] py-2 font-medium">올린 사람</th>
                      <th className="w-[11%] py-2 font-medium">날짜</th>
                      <th className="w-[200px] py-2">
                        <span className="sr-only">동작</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file) => {
                      const { source } = file;
                      return (
                        <tr
                          key={source.kind === "chat" ? `chat:${source.messageId}` : `document:${file.fileId}`}
                          className="border-b border-line/60 hover:bg-hover"
                        >
                          <td className="py-1.5 pl-2">
                            <span className="flex min-w-0 items-center gap-2.5">
                              <span aria-hidden className="flex size-7 flex-none items-center justify-center rounded-control bg-paper-2 text-ink-soft">
                                <FileIcon size={14} />
                              </span>
                              <span className="truncate font-medium text-ink" title={file.name}>
                                {file.name}
                              </span>
                            </span>
                          </td>
                          <td className="truncate pr-2 text-ink-soft">
                            {source.kind === "document" ? (
                              <span title={source.documentName}>{source.documentName}</span>
                            ) : (
                              <span className="rounded-control bg-paper-2 px-1.5 py-0.5 text-xs">채팅</span>
                            )}
                          </td>
                          <td className="text-ink-soft">{readableSize(file.size)}</td>
                          <td className="truncate pr-2 text-ink-soft">{file.uploadedBy}</td>
                          <td className="text-ink-soft">
                            <time dateTime={file.uploadedAt}>{day.format(new Date(file.uploadedAt))}</time>
                          </td>
                          <td>
                            <span className="flex justify-end gap-0.5 pr-2">
                              {isInlineType(file.type) ? (
                                <button
                                  type="button"
                                  onClick={() => setPreviewing({ fileId: file.fileId, fileName: file.name, fileType: file.type })}
                                  aria-label={`${file.name} 미리보기`}
                                  className={ACTION}
                                >
                                  미리보기
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() =>
                                  source.kind === "document"
                                    ? goToBlock(source.documentId, source.blockId)
                                    : openChatAt(source.messageId)
                                }
                                aria-label={`${file.name} 원본 위치`}
                                className={ACTION}
                              >
                                원본 위치
                              </button>
                              <a
                                href={`/api/files/${file.fileId}/download`}
                                aria-label={`${file.name} 내려받기`}
                                className={ACTION}
                              >
                                내려받기
                              </a>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
      <FilePreviewDialog file={previewing} onClose={closePreview} />
    </div>
  );
}
