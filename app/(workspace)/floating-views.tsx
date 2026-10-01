"use client";

import type { Client } from "@yorkie-js/sdk";
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { readBlocks } from "@/lib/blocks/document";
import { isTextBearing } from "@/lib/blocks/registry";
import type { Block } from "@/lib/blocks/types";
import type { Frame } from "@/lib/chat/window-frame";
import type { WorkspaceDocument } from "@/lib/documents/documents";
import { acquireBlockDocument, releaseBlockDocument } from "@/lib/documents/attach-pool";
import {
  STORAGE_KEY,
  applyFloatingGesture,
  closeView,
  fitFloating,
  fitView,
  moveView,
  openView,
  parseViews,
  type BlockRef,
  type FloatingGesture,
  type FloatingView,
  type Size,
} from "@/lib/floating/views";

import { FloatingFrame } from "./floating-frame";
import { useWorkspacePresence } from "./presence-provider";
import { useFrameGesture, viewport, type FrameRules } from "./use-frame-gesture";

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
  const names = useDocumentNames();

  // After mount, not during render: the server has no `localStorage`.
  useEffect(() => {
    // Fitted like the chat window's saved frame is clamped: the viewport may
    // have shrunk since these were saved.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a one-time read of browser-only state
    setViews(readViews().map((v) => ({ ...v, frame: fitFloating(v.frame, v.base, viewport()) })));
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
  const fit = useCallback(
    (ref: BlockRef, base: Size) => update((current) => fitView(current, ref, base, viewport())),
    [update],
  );

  // A viewport that shrank leaves windows partly unreachable. Here rather than
  // in each window: the saved frames are what has to change.
  useEffect(() => {
    const onResize = () =>
      update((current) => {
        let changed = false;
        const next = current.map((view) => {
          const frame = fitFloating(view.frame, view.base, viewport());
          if (sameFrame(frame, view.frame)) return view;
          changed = true;
          return { ...view, frame };
        });
        return changed ? next : current;
      });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [update]);

  return (
    <FloatingViewsContext.Provider value={open}>
      {children}
      {views.map((view) => (
        <FloatingWindow
          key={`${view.documentId}:${view.blockId}`}
          client={client}
          colorTag={colorTag}
          nickname={nickname}
          documentName={names.get(view.documentId)}
          onClose={close}
          onFit={fit}
          onMove={move}
          view={view}
        />
      ))}
    </FloatingViewsContext.Provider>
  );
}

const sameFrame = (a: Frame, b: Frame) =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/** Every document's name by id, `null` once deleted: the catalogue once, then
 *  kept current by the workspace socket — the same events and shape
 *  `document-list.tsx` listens to. */
function useDocumentNames(): Map<string, string | null> {
  const [names, setNames] = useState<Map<string, string | null>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const merge = (entries: Array<[string, string | null]>) =>
      setNames((current) => new Map([...current, ...entries]));

    fetch("/api/documents")
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { documents: Array<WorkspaceDocument> } | null) => {
        if (!cancelled && body) merge(body.documents.map((d) => [d.id, d.name]));
      })
      .catch(() => undefined);

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/workspace/ws`);
    socket.addEventListener("message", (event) => {
      let message: { event?: string; payload?: unknown };
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.event === "document:created" || message.event === "document:changed") {
        const { document } = message.payload as { document: WorkspaceDocument };
        merge([[document.id, document.name]]);
      }
      if (message.event === "document:deleted") {
        const { ids } = message.payload as { ids: Array<string> };
        merge(ids.map((id) => [id, null]));
      }
    });

    return () => {
      cancelled = true;
      socket.close();
    };
  }, []);

  return names;
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
        // An edit elsewhere in the document leaves it unchanged, and then
        // nothing re-renders.
        let last = "";
        const read = () => {
          const stored = (doc.getRoot().blocks ?? []).find((b) => b?.id === blockId);
          const [block] = stored ? readBlocks([stored]) : [];
          const key = block ? JSON.stringify(block) : "deleted";
          if (key === last) return;
          last = key;
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

/** The types a floating view can show — the editor offers the button only on these. */
export function canFloat(block: Block): boolean {
  return isTextBearing(block) || block.type === "image" || block.type === "pdf";
}

/** The widest (and, for an image, tallest) a block's content is measured at
 *  scale 1; a PDF has no size of its own and gets this box. Plus `p-3`'s 12px
 *  a side. */
const MEASURE_MAX = 360;
const PAD = 24;
const PDF_BASE: Size = { width: MEASURE_MAX + PAD, height: 480 + PAD };

function MirrorBody({ block, onImage }: { block: Block; onImage: (img: HTMLImageElement) => void }) {
  if (block.type === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- same reason as `image-block.tsx`
      <img
        src={`/api/files/${block.fileId}/preview`}
        alt={block.fileName}
        onLoad={(event) => onImage(event.currentTarget)}
        className="block max-w-full"
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

/** Memoised: its props are stable unless this view itself changed, so opening
 *  or moving one window leaves the others alone. */
const FloatingWindow = memo(function FloatingWindow({
  view,
  client,
  colorTag,
  nickname,
  documentName,
  onClose,
  onFit,
  onMove,
}: {
  view: FloatingView;
  client: Client | null;
  colorTag: string;
  nickname: string;
  /** `undefined` until the catalogue arrives, `null` once the document is deleted. */
  documentName: string | null | undefined;
  onClose: (ref: BlockRef) => void;
  onFit: (ref: BlockRef, base: Size) => void;
  onMove: (ref: BlockRef, frame: Frame) => void;
}) {
  const { documentId, blockId, base } = view;
  const mirror = useMirroredBlock(client, view, colorTag, nickname);

  // Only while a gesture runs; otherwise the saved frame is the frame. The saved
  // list is written once per drag, not per pointer move.
  const [dragging, setDragging] = useState<Frame | null>(null);
  const frame = dragging ?? view.frame;
  const onEnd = useCallback(
    (next: Frame) => {
      onMove({ documentId, blockId }, next);
      setDragging(null);
    },
    [onMove, documentId, blockId],
  );
  const rules = useMemo<FrameRules<FloatingGesture>>(
    () => ({
      apply: (kind, start, dx, dy, vp) => applyFloatingGesture(kind, start, dx, dy, vp, base),
      fit: (next, vp) => fitFloating(next, base, vp),
    }),
    [base],
  );
  const begin = useFrameGesture(frame, setDragging, onEnd, rules);

  // First render of the content, at scale 1: measure it and fit the window to
  // it. Before paint, so the unfitted window never shows. An image waits for
  // its bytes — `onImage` below.
  const content = useRef<HTMLDivElement>(null);
  const block = mirror.status === "ready" ? mirror.block : null;
  useLayoutEffect(() => {
    if (base || !block || block.type === "image" || !content.current) return;
    if (block.type === "pdf") {
      onFit({ documentId, blockId }, PDF_BASE);
      return;
    }
    const { offsetWidth, offsetHeight } = content.current;
    onFit({ documentId, blockId }, { width: offsetWidth, height: offsetHeight });
  }, [base, block, documentId, blockId, onFit]);
  const onImage = useCallback(
    (img: HTMLImageElement) => {
      if (base) return;
      const shrink = Math.min(1, MEASURE_MAX / img.naturalWidth, MEASURE_MAX / img.naturalHeight);
      onFit(
        { documentId, blockId },
        {
          width: Math.round(img.naturalWidth * shrink) + PAD,
          height: Math.round(img.naturalHeight * shrink) + PAD,
        },
      );
    },
    [base, documentId, blockId, onFit],
  );

  const gone = documentName === null;
  const title = gone ? "삭제된 문서" : (documentName ?? "…");

  return (
    <FloatingFrame
      frame={frame}
      begin={begin}
      resize="corner"
      label={`플로팅 뷰: ${title}`}
      title={
        <span className="truncate text-[11px] font-semibold text-ink-soft">
          <span aria-hidden>🪟 </span>
          {title}
        </span>
      }
      closeLabel="플로팅 뷰 닫기"
      closeClassName="font-bold text-red-600"
      onClose={() => onClose({ documentId, blockId })}
      className="z-[35]"
      headerClassName="bg-sky-soft"
    >
      <div className="min-h-0 flex-1 overflow-auto">
        {block && !gone ? (
          // Scaled, not re-laid-out: the content keeps the shape it was
          // measured at and the window's width over that is the zoom. Unmeasured
          // it takes its own size, up to `MEASURE_MAX`. ponytail: `base` is
          // fixed at the first fit, so content that grows later scrolls here
          // rather than resizing the window under the reader.
          <div
            ref={content}
            className="p-3"
            style={
              base
                ? {
                    zoom: frame.width / base.width,
                    width: base.width,
                    height: block.type === "pdf" ? base.height : undefined,
                  }
                : { width: "max-content", maxWidth: MEASURE_MAX + PAD }
            }
          >
            <MirrorBody block={block} onImage={onImage} />
          </div>
        ) : null}
        {gone ? <Notice>원본 문서가 삭제되었습니다.</Notice> : null}
        {!gone && mirror.status === "deleted" ? <Notice>원본 블록이 삭제되었습니다.</Notice> : null}
        {!gone && mirror.status === "failed" ? <Notice>원본을 열 수 없습니다.</Notice> : null}
      </div>
    </FloatingFrame>
  );
});

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="p-3 text-sm text-ink-faint">{children}</p>;
}
