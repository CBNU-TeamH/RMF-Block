"use client";

import type { Client } from "@yorkie-js/sdk";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { readBlocks } from "@/lib/blocks/document";
import { isTextBearing } from "@/lib/blocks/registry";
import type { Block, BlockType } from "@/lib/blocks/types";
import type { Frame } from "@/lib/chat/window-frame";
import { acquireBlockDocument, releaseBlockDocument } from "@/lib/documents/attach-pool";
import {
  STORAGE_KEY,
  closeView,
  moveView,
  openView,
  parseViews,
  type BlockRef,
  type FloatingView,
} from "@/lib/floating/views";

import { FloatingFrame } from "./floating-frame";
import { useWorkspacePresence } from "./presence-provider";
import { useFrameGesture, viewport } from "./use-frame-gesture";

/** Floating views (UC-070): blocks pinned into windows over the workspace. The
 *  provider sits in the workspace layout, which never remounts across document
 *  navigation — that is all FR-070-03 takes. Each window is a read-only mirror
 *  of its block, sharing the editor's attachment when both show one document. */

/** Opens a view of a block — the one thing the editor needs from here. */
const FloatingViewsContext = createContext<(ref: BlockRef) => void>(() => undefined);

export const useFloatingViews = () => useContext(FloatingViewsContext);

function readViews(): Array<FloatingView> {
  try {
    return parseViews(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

function writeViews(views: Array<FloatingView>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  } catch {
    // Unavailable or full: the windows still work, they just are not restored.
  }
}

export function FloatingViewProvider({
  colorTag,
  nickname,
  children,
}: {
  colorTag: string;
  nickname: string;
  children: React.ReactNode;
}) {
  const { client } = useWorkspacePresence();
  const [views, setViews] = useState<Array<FloatingView>>([]);

  // After mount, not during render: the server has no `localStorage`.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a one-time read of browser-only state
    setViews(readViews());
  }, []);

  const update = useCallback((change: (views: Array<FloatingView>) => Array<FloatingView>) => {
    setViews((current) => {
      const next = change(current);
      if (next !== current) writeViews(next);
      return next;
    });
  }, []);

  const open = useCallback(
    (ref: BlockRef) => update((current) => openView(current, ref, viewport())),
    [update],
  );
  const close = useCallback((ref: BlockRef) => update((current) => closeView(current, ref)), [update]);
  const move = useCallback(
    (ref: BlockRef, frame: Frame) => update((current) => moveView(current, ref, frame)),
    [update],
  );

  return (
    <FloatingViewsContext.Provider value={open}>
      {children}
      {views.map((view) => (
        <FloatingWindow
          key={`${view.documentId}:${view.blockId}`}
          client={client}
          colorTag={colorTag}
          nickname={nickname}
          onClose={close}
          onMove={move}
          view={view}
        />
      ))}
    </FloatingViewsContext.Provider>
  );
}

type Mirror =
  | { status: "loading" }
  | { status: "ready"; block: Block }
  | { status: "deleted" }
  | { status: "failed" };

/** One block, live. Never writes — no seed, no presence beyond `activeBlockId:
 *  null`, which occupancy already ignores, so the viewer shows up nowhere. */
function useMirroredBlock(
  client: Client | null,
  { documentId, blockId }: BlockRef,
  colorTag: string,
  nickname: string,
): Mirror {
  const [mirror, setMirror] = useState<Mirror>({ status: "loading" });

  useEffect(() => {
    if (!client) return undefined;

    let cancelled = false;
    let held = false;
    let unsubscribe: (() => void) | undefined;

    const presence = { activeBlockId: null, colorTag, nickname, updatedAt: Date.now() };
    const setup = acquireBlockDocument(client, documentId, presence)
      .then((doc) => {
        held = true;
        if (cancelled) return;

        // Converts only this block; the find is still O(n) — fine at 8 users.
        const read = () => {
          const stored = (doc.getRoot().blocks ?? []).find((b) => b?.id === blockId);
          const [block] = stored ? readBlocks([stored]) : [];
          setMirror(block ? { status: "ready", block } : { status: "deleted" });
        };
        read();
        // Content changes only, local ones included: the editor's own edits
        // reach the mirror through this same shared document.
        unsubscribe = doc.subscribe((event) => {
          if (
            event.type === "local-change" ||
            event.type === "remote-change" ||
            event.type === "snapshot"
          ) {
            read();
          }
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setMirror({ status: "failed" });
        console.error(`Could not open document ${documentId} for a floating view`, error);
      });

    return () => {
      cancelled = true;
      void setup.finally(() => {
        unsubscribe?.();
        if (held) releaseBlockDocument(client, documentId);
      });
    };
  }, [client, documentId, blockId, colorTag, nickname]);

  return mirror;
}

/** Title-bar names, for exactly the types `canFloat` admits. */
const LABELS: Partial<Record<BlockType, string>> = {
  text: "텍스트",
  heading: "제목",
  list: "목록",
  checklist: "체크리스트",
  quote: "인용",
  code: "코드",
  image: "이미지",
  pdf: "PDF",
};

/** The types a floating view can show — the editor offers the button only on these. */
export function canFloat(block: Block): boolean {
  return isTextBearing(block) || block.type === "image" || block.type === "pdf";
}

function MirrorBody({ block }: { block: Block }) {
  if (block.type === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- same reason as `image-block.tsx`
      <img
        src={`/api/files/${block.fileId}/preview`}
        alt={block.fileName}
        className="max-h-full max-w-full"
      />
    );
  }
  if (block.type === "pdf") {
    return (
      <iframe
        src={`/api/files/${block.fileId}/preview`}
        title={block.fileName}
        className="h-full w-full"
      />
    );
  }
  if (!isTextBearing(block)) return null;

  return (
    <p
      className={`whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink ${
        block.type === "heading" ? "text-lg font-bold" : ""
      } ${block.type === "code" ? "font-mono text-[12.5px]" : ""}`}
    >
      {block.type === "checklist" ? (block.checked ? "☑ " : "☐ ") : null}
      {block.text}
    </p>
  );
}

function FloatingWindow({
  view,
  client,
  colorTag,
  nickname,
  onClose,
  onMove,
}: {
  view: FloatingView;
  client: Client | null;
  colorTag: string;
  nickname: string;
  onClose: (ref: BlockRef) => void;
  onMove: (ref: BlockRef, frame: Frame) => void;
}) {
  const { documentId, blockId } = view;
  const mirror = useMirroredBlock(client, view, colorTag, nickname);

  // Local while dragging, handed up once the gesture ends — the saved list is
  // written per drag, not per pointer move.
  const [frame, setFrame] = useState<Frame | null>(view.frame);
  const onEnd = useCallback(
    (next: Frame) => onMove({ documentId, blockId }, next),
    [onMove, documentId, blockId],
  );
  const begin = useFrameGesture(frame, setFrame, onEnd);

  if (!frame) return null;

  const title =
    mirror.status === "ready"
      ? `${LABELS[mirror.block.type] ?? "블록"} · 실시간`
      : mirror.status === "loading"
        ? "불러오는 중"
        : "원본 없음";

  return (
    <FloatingFrame
      frame={frame}
      begin={begin}
      label={`플로팅 뷰: ${title}`}
      title={
        <span className="truncate font-mono text-[10px] tracking-wide text-ink-soft">
          <span aria-hidden>🪟 </span>
          {title}
        </span>
      }
      closeLabel="플로팅 뷰 닫기"
      onClose={() => onClose({ documentId, blockId })}
      className="z-[35]"
      headerClassName="bg-sky-soft"
    >
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {mirror.status === "ready" ? <MirrorBody block={mirror.block} /> : null}
        {mirror.status === "deleted" ? (
          <p className="text-sm text-ink-faint">원본 블록이 삭제되었습니다.</p>
        ) : null}
        {mirror.status === "failed" ? (
          <p className="text-sm text-ink-faint">원본을 열 수 없습니다.</p>
        ) : null}
      </div>
    </FloatingFrame>
  );
}
