"use client";

import type { Document } from "@yorkie-js/sdk";
import { memo, useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";

import type { BlockDocumentRoot } from "@/lib/blocks/document";
import type { Block } from "@/lib/blocks/types";
import { readBoxes } from "@/lib/focus/dom";
import {
  capMarks,
  extendMark,
  inkPointAt,
  markPixelSegments,
  shouldAcceptPoint,
  startMark,
  type InkBox,
  type Mark,
  type MarkKind,
} from "@/lib/focus/ink";
import { inkFrom, type BlockPresence } from "@/lib/presence/occupancy";

import { PUBLISH_MS } from "./use-focus-presence";

/** The highlighter's stroke thickness — this editor's own line box:
 *  `text-[14px]` at the browser's normal line height, plus `text-block.tsx`'s
 *  `py-0.5` on each side. Not a minimum height on a band any more: a freehand
 *  stroke has no band, only a path, so this is a constant width throughout. */
const HIGHLIGHT_STROKE_PX = 20;
const UNDERLINE_PX = 2;

const TOOLS: Array<{ kind: MarkKind; label: string }> = [
  { kind: "underline", label: "밑줄" },
  { kind: "highlight", label: "형광펜" },
];

/** The presenter's marks over the block editor (FR-030-12/13/14), and the drag
 *  surface that makes them. Why an overlay is not optional, why marks are
 *  block-anchored rather than pixels, why they are freehand paths rather than
 *  straight bands, and why they are read here rather than in
 *  `useBlockDocument`: `docs/design/presence-and-focus.md`, "The ink layer". */
export function InkOverlay({
  containerRef,
  docRef,
  blocks,
  blocksLoaded,
  memberId,
  colorTag,
  isPresenting,
  followingId,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  docRef: RefObject<Document<BlockDocumentRoot, BlockPresence> | null>;
  /** A dependency of the box measurement only: someone inserting a block above
   *  moves every box without a mark's own anchor changing. */
  blocks: Array<Block> | null;
  blocksLoaded: boolean;
  memberId: string;
  colorTag: string;
  isPresenting: boolean;
  followingId: string | null;
}) {
  const [boxes, setBoxes] = useState<Array<InkBox>>([]);
  // The scroll container's own visible height — a short document's content
  // can be shorter than the pane it's shown in, and the canvas has to cover
  // the pane, not just the content, or its bottom half is undrawable.
  const [viewportHeight, setViewportHeight] = useState(0);
  const [picked, setPicked] = useState<MarkKind | null>(null);
  /** Derived, not stored: a tool left selected when a share ends would leave
   *  this overlay capturing pointer events over a document nobody can edit. */
  const tool = isPresenting ? picked : null;
  /** This browser's own finished strokes. Local state, never read back off its
   *  own presence — reading your own published state re-renders on every
   *  publish, which is the bug `presence-and-focus.md` records. Not two
   *  owners: the published copy is written here and read only by other
   *  browsers. */
  const [mine, setMine] = useState<Array<Mark>>([]);
  /** The stroke currently under the pointer, or `null` between drags. Folded
   *  into `shown` below rather than kept as a separate "preview" — it already
   *  *is* a `Mark`, decoded the same way a finished one is. */
  const [drawing, setDrawing] = useState<Mark | null>(null);
  const [received, setReceived] = useState<{ marks: Array<Mark>; colorTag: string } | null>(null);

  // Mirrors of the two states above, read inside the publish timer's fire-time
  // callback so it always sends the *current* stroke rather than whatever it
  // closed over when scheduled — the same reason `use-focus-presence.ts`
  // re-reads `container.scrollTop` at fire time instead of capturing it.
  const mineRef = useRef<Array<Mark>>([]);
  const drawingRef = useRef<Mark | null>(null);
  // The last point accepted onto the current stroke, in raw container pixels
  // — `shouldAcceptPoint`'s comparison space, not the anchored ratio space.
  const lastAcceptedPixelRef = useRef<{ x: number; y: number } | null>(null);
  // The trailing-edge throttle's own state, refs rather than effect-local
  // `let`s because a drag starts and stops repeatedly while this component
  // stays mounted — not a lifetime an effect scope fits.
  const publishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const publishedAtRef = useRef(0);

  // Declared early, ahead of the effect below that needs it — only touches
  // the ref above, so it has nothing else to wait on.
  const cancelScheduledPublish = () => {
    if (publishTimerRef.current === null) return;
    clearTimeout(publishTimerRef.current);
    publishTimerRef.current = null;
  };

  // Re-measured whenever the block list changes, and whenever the container's
  // own pane or any current block's rendered size changes. Two different
  // motivations: the container itself resizing is an ordinary window resize;
  // a block resizing out from under an unchanged pane is what an image with
  // no intrinsic width/height does once its async load finishes — a box
  // measured before that shifts everything below it once it does, and
  // nothing about the block *list* changes to trigger a re-measure on its own.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      setBoxes(readBoxes(container));
      setViewportHeight(container.clientHeight);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(container);
    for (const el of container.querySelectorAll<HTMLElement>("[data-block-id]")) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [blocks, containerRef]);

  // A second reader on the content document's `others` channel, rather than a
  // branch inside `useBlockDocument`'s: that one ends in `setOccupantByBlock`,
  // which re-renders every block in the document. Ink arrives far too often for
  // that (`presence-and-focus.md`, "Ink is read where it is drawn").
  useEffect(() => {
    const doc = docRef.current;
    if (!doc) return;

    const read = () => setReceived(inkFrom(doc.getOthersPresences(), followingId));
    // Subscribe before the first read, so an arrival between the two is not
    // missed — the ordering `presence-and-focus.md` already fixed for presence.
    const unsubscribe = doc.subscribe("others", read);
    read();

    return unsubscribe;
    // Never `blocks`: it is a fresh array on every recompute and would rebuild
    // this subscription continuously, dropping the events landing in the gap.
  }, [docRef, blocksLoaded, followingId]);

  // Ending a share forgets what was drawn, or the next one would resurrect it.
  // Settled during render rather than in an effect, the way
  // `focus-follow-provider.tsx` settles a follow that has stopped: the answer is
  // already in hand, and an effect would only force a second render to reach it.
  if (!isPresenting && mine.length > 0) setMine([]);
  if (!isPresenting && drawing) setDrawing(null);

  // The ref/publish half of the same transition: a ref is not safe to write
  // during render, and a pending throttle timer has to be cancelled explicitly
  // rather than left to race this `doc.update` on ordering. Unthrottled by
  // construction — a separate effect the drag throttle below never touches.
  useEffect(() => {
    if (isPresenting) return;

    cancelScheduledPublish();
    mineRef.current = [];
    drawingRef.current = null;

    const doc = docRef.current;
    if (!doc) return;

    doc.update((_root, presence) => {
      presence.set({ marks: null });
    });
  }, [isPresenting, docRef]);

  // A stroke mid-throttle when this unmounts (document navigation) must not
  // fire a `doc.update` against a document this component no longer owns —
  // the same guard `use-focus-presence.ts`'s own timer cleans up on unmount.
  useEffect(() => {
    return () => {
      if (publishTimerRef.current !== null) clearTimeout(publishTimerRef.current);
    };
  }, []);

  const publishNow = (marks: Array<Mark>) => {
    const doc = docRef.current;
    if (!doc) return;

    doc.update((_root, presence) => {
      presence.set({ id: memberId, marks });
    });
    publishedAtRef.current = Date.now();
  };

  // Trailing edge, wall clock — `use-focus-presence.ts`'s own idiom, reused
  // rather than reinvented. A pending timer is left alone; it reads the refs
  // above when it fires, which is what makes that safe.
  const schedulePublish = () => {
    if (publishTimerRef.current !== null) return;

    const wait = Math.max(0, PUBLISH_MS - (Date.now() - publishedAtRef.current));
    publishTimerRef.current = setTimeout(() => {
      publishTimerRef.current = null;
      const current = drawingRef.current
        ? [...mineRef.current, drawingRef.current]
        : mineRef.current;
      publishNow(current);
    }, wait);
  };

  /** A pointer event in the scroll container's own raw pixel space — the one
   *  `readBoxes` measures in, and what `shouldAcceptPoint` compares against.
   *  The container carries padding but no border, so its border box and
   *  padding box share an origin. */
  const rawPointFrom = (event: PointerEvent<SVGSVGElement>): { x: number; y: number } | null => {
    const container = containerRef.current;
    if (!container) return null;

    const rect = container.getBoundingClientRect();

    return {
      x: event.clientX - rect.left + container.scrollLeft,
      y: event.clientY - rect.top + container.scrollTop,
    };
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (!tool) return;
    const raw = rawPointFrom(event);
    if (!raw) return;

    // `boxes` state, not a fresh `readBoxes` — nobody edits mid-drag, so it's
    // already exactly what re-querying the DOM would give, at a fraction of
    // the cost. Calling `readBoxes` here was the actual cause of strokes
    // breaking up: a full layout read on every accepted point is expensive
    // enough, at the 2px thinning floor, to drop paint frames mid-drag.
    const point = inkPointAt(boxes, raw.x, raw.y);
    if (!point) return;

    // Capture, so a drag that leaves the container still reports; and
    // `preventDefault`, or the browser starts a text selection underneath.
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();

    lastAcceptedPixelRef.current = raw;
    const started = startMark(tool, point);
    drawingRef.current = started;
    setDrawing(started);

    // Once up front, not only on the next move — the same rule
    // `use-focus-presence.ts`'s presenter effect follows for the scroll anchor.
    publishNow([...mineRef.current, started]);
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!tool || !drawingRef.current) return;
    const raw = rawPointFrom(event);
    if (!raw) return;
    if (!shouldAcceptPoint(lastAcceptedPixelRef.current, raw)) return;

    // `boxes` state, not `readBoxes` — see `onPointerDown`'s comment. This
    // handler is the hot path: at a fast drag, hundreds of accepted points a
    // second, so a DOM re-query per point was the real cost.
    const point = inkPointAt(boxes, raw.x, raw.y);
    if (!point) return;

    lastAcceptedPixelRef.current = raw;
    const extended = extendMark(drawingRef.current, point);
    drawingRef.current = extended;
    setDrawing(extended);
    schedulePublish();
  };

  const onPointerUp = () => {
    if (!drawingRef.current) return;

    const finished = capMarks([...mineRef.current, drawingRef.current]);
    cancelScheduledPublish();

    mineRef.current = finished;
    setMine(finished);
    drawingRef.current = null;
    setDrawing(null);
    lastAcceptedPixelRef.current = null;

    // Unthrottled: without this, points accepted after the last throttle tick
    // would sit unsent until a tick that, since the drag just ended, may never
    // come.
    publishNow(finished);
  };

  const onPointerCancel = () => {
    if (!drawingRef.current) return;

    cancelScheduledPublish();
    drawingRef.current = null;
    setDrawing(null);
    lastAcceptedPixelRef.current = null;

    // Revert to the committed marks — a canceled stroke should not leave the
    // partial progress already published mid-drag standing forever.
    publishNow(mineRef.current);
  };

  const clearMine = () => {
    mineRef.current = [];
    setMine([]);
    cancelScheduledPublish();
    publishNow([]);
  };

  const shown = isPresenting ? (drawing ? [...mine, drawing] : mine) : (received?.marks ?? []);
  const shownColor = isPresenting ? colorTag : (received?.colorTag ?? colorTag);
  // The taller of the content and the visible pane: a document shorter than
  // its own viewport still gets a full-height canvas rather than stopping at
  // its last block, and a document longer than the viewport still scrolls the
  // canvas with it. Not `scrollHeight` for the long case — the footer under
  // the document would add a screenful of empty overlay past the real content,
  // and not `inset-0` alone for the short case — that pins to the *current*
  // scroll position and would clip a mark once the page scrolls past it.
  const last = boxes[boxes.length - 1];
  const contentHeight = last ? last.top + last.height : 0;
  const height = Math.max(contentHeight, viewportHeight);

  return (
    <>
      {/* Last child of the scroll container: at equal `z-index` later DOM order
          paints on top, which is how pen mode covers `text-block.tsx`'s `z-20`
          slash menu without claiming the `z-30` the modals use. */}
      <svg
        aria-hidden
        width="100%"
        height={height}
        className={`absolute left-0 top-0 ${
          tool ? "z-20 touch-none" : "z-10 pointer-events-none"
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {shown.map((mark, index) => (
          <MarkShape key={index} boxes={boxes} mark={mark} color={shownColor} />
        ))}
      </svg>

      {isPresenting ? (
        // `fixed`, so the bar takes no layout space — a sticky one would shift
        // every block's `offsetTop` for the presenter alone. `editor.tsx`'s
        // modals already use `fixed` inside this container for the same reason.
        <div className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 gap-1 rounded-md border border-ink bg-paper px-1.5 py-1 shadow-lg">
          {TOOLS.map((item) => (
            <button
              key={item.kind}
              type="button"
              aria-pressed={tool === item.kind}
              onClick={() => setPicked(tool === item.kind ? null : item.kind)}
              className={`rounded px-2 py-0.5 font-mono text-[11px] font-medium text-ink ${
                tool === item.kind ? "bg-sky-soft" : "bg-transparent"
              }`}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={clearMine}
            disabled={mine.length === 0}
            className="rounded px-2 py-0.5 font-mono text-[11px] font-medium text-ink disabled:opacity-40"
          >
            지우기
          </button>
        </div>
      ) : null}
    </>
  );
}

/** One stroke, drawn as one polyline per contiguous same-block segment — a
 *  highlight is a thick translucent line, an underline a thin opaque one, both
 *  following the path exactly rather than a straight band. A seam can show
 *  where a stroke crosses a block boundary, since each segment decodes
 *  independently: the accepted "sub-block drift" limitation, not a bug.
 *
 *  `memo`d: a finished mark's props (`boxes`, `mark`, `color`) stay reference-
 *  stable across every point accepted onto some *other*, still-in-progress
 *  stroke — without this, every already-drawn mark re-decodes through
 *  `markPixelSegments` on every one of those points instead of just the one
 *  actually changing. */
const MarkShape = memo(function MarkShape({
  boxes,
  mark,
  color,
}: {
  boxes: Array<InkBox>;
  mark: Mark;
  color: string;
}) {
  return (
    <>
      {markPixelSegments(boxes, mark).map((points, index) => (
        <polyline
          key={index}
          points={points.map((point) => `${point.x},${point.y}`).join(" ")}
          fill="none"
          stroke={color}
          strokeWidth={mark.kind === "underline" ? UNDERLINE_PX : HIGHLIGHT_STROKE_PX}
          strokeOpacity={mark.kind === "underline" ? 1 : 0.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </>
  );
});
