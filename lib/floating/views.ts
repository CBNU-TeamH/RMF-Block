import { BAR_HEIGHT, clamp, toFrame, type Frame, type Viewport } from "../chat/window-frame.ts";

/** The floating views one viewer has open (UC-070), as arithmetic on a list.
 *  Kept in `localStorage` — which blocks this person pinned, and where, is
 *  worth nothing to anyone else and never sent anywhere. */

export const STORAGE_KEY = "rmf-floating-views";

export type BlockRef = { documentId: string; blockId: string };

/** A stored file shown on its own — a chat attachment (#143). Its four fields are
 *  the attachment's, so the window needs no lookup to draw it. */
export type FileRef = { fileId: string; fileName: string; fileType: string; size: number };

export type ViewRef = BlockRef | FileRef;

export const isFileRef = (ref: ViewRef): ref is FileRef => "fileId" in ref;

/** One string per source. Both kinds are prefixed, so a block and a file never
 *  collide whatever their ids read. */
export const refKey = (ref: ViewRef) =>
  isFileRef(ref) ? `file:${ref.fileId}` : `block:${ref.documentId}:${ref.blockId}`;

export type Size = { width: number; height: number };

/** `base` is the content's own size at scale 1, measured once it first renders.
 *  The window keeps that ratio, and its width over `base.width` is the scale. */
export type FloatingView = ViewRef & { frame: Frame; base?: Size };

/** The title bar's height — `h-9` in `floating-frame.tsx` (border-box, so its
 *  `border-b` is inside the 36px). */
export const HEADER = 36;
/** Narrower than this and the content stops being readable at any scale. */
export const MIN_CONTENT_WIDTH = 120;
/** The narrowest a window is fitted: one short line would otherwise leave no
 *  room for the document's name beside the ✕. */
export const MIN_FIT_WIDTH = 160;
/** A window's size is this module's to decide; `clamp` only positions it. */
const LOOSE: Size = { width: 0, height: 0 };

/** Until the content is measured — wireframe size, `FloatedMirror`. */
const WIDTH = 320;
const HEIGHT = 220;
/** How far each new window steps down-left from the last, so a second one never
 *  lands exactly on top of the first and hides it. */
const CASCADE = 24;
/** Clear of the workspace header. */
const TOP = 56;

const sameRef = (a: ViewRef, b: ViewRef) => refKey(a) === refKey(b);

/** The source fields of a saved entry, or `null` when it names neither kind. */
function toRef(entry: Record<string, unknown>): ViewRef | null {
  if (typeof entry.documentId === "string" && typeof entry.blockId === "string") {
    return { documentId: entry.documentId, blockId: entry.blockId };
  }
  const { fileId, fileName, fileType, size } = entry;
  if (
    typeof fileId === "string" &&
    typeof fileName === "string" &&
    typeof fileType === "string" &&
    typeof size === "number"
  ) {
    return { fileId, fileName, fileType, size };
  }
  return null;
}

/** The saved list, keeping only entries that are whole — a malformed one is
 *  dropped rather than taking the rest down with it. */
export function parseViews(raw: string | null): Array<FloatingView> {
  if (!raw) return [];

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];

  const views: Array<FloatingView> = [];
  for (const entry of value as Array<Record<string, unknown> | null>) {
    const ref = entry ? toRef(entry) : null;
    if (!entry || !ref) continue;
    const frame = toFrame(entry.frame);
    // Nothing this app writes has no width, and the ratio would be NaN.
    if (!frame || frame.width <= 0) continue;
    const base = toSize(entry.base);
    const view: FloatingView = { ...ref, frame };
    if (base) view.base = base;
    if (!views.some((open) => sameRef(open, view))) views.push(view);
  }
  return views;
}

/** Adds a view of `ref`, or leaves the list alone if that source is already
 *  open — two windows of one block or file show nothing the first did not. */
export function openView(
  views: Array<FloatingView>,
  ref: ViewRef,
  viewport: Viewport,
): Array<FloatingView> {
  if (views.some((view) => sameRef(view, ref))) return views;

  const slot = (i: number) =>
    clamp(
      {
        x: viewport.width - WIDTH - CASCADE - i * CASCADE,
        y: TOP + i * CASCADE,
        width: WIDTH,
        height: HEIGHT,
      },
      viewport,
      LOOSE,
    );
  // The first slot no window still sits on — counting windows instead lands a
  // new one exactly on another once an earlier one has closed. By right edge:
  // fitting keeps it and moves `x`. Capped: on a small viewport far slots
  // clamp onto one spot and would never come free.
  const right = (frame: Frame) => frame.x + frame.width;
  const taken = (frame: Frame) =>
    views.some((view) => right(view.frame) === right(frame) && view.frame.y === frame.y);
  let i = 0;
  while (i < views.length && taken(slot(i))) i += 1;
  return [...views, { ...ref, frame: slot(i) }];
}

export function closeView(views: Array<FloatingView>, ref: ViewRef): Array<FloatingView> {
  return views.filter((view) => !sameRef(view, ref));
}

export function moveView(
  views: Array<FloatingView>,
  ref: ViewRef,
  frame: Frame,
): Array<FloatingView> {
  return views.map((view) => (sameRef(view, ref) ? { ...view, frame } : view));
}

/** Records the measured content size and fits the window to it at scale 1,
 *  keeping its right edge — new windows cascade from the top right. */
export function fitView(
  views: Array<FloatingView>,
  ref: ViewRef,
  measured: Size,
  viewport: Viewport,
): Array<FloatingView> {
  const base = { ...measured, width: Math.max(measured.width, MIN_FIT_WIDTH) };
  return views.map((view) => {
    if (!sameRef(view, ref)) return view;
    const { frame } = view;
    const sized = {
      x: frame.x + frame.width - base.width,
      y: frame.y,
      width: base.width,
      height: HEADER + base.height,
    };
    return { ...view, base, frame: fitFloating(sized, base, viewport) };
  });
}

/** Content height over width, from `base` or — before it is measured — from
 *  the window itself. */
const ratioOf = (frame: Frame, base: Size | undefined) =>
  base ? base.height / base.width : Math.max(frame.height - HEADER, 1) / frame.width;

const withWidth = (frame: Frame, width: number, ratio: number): Frame => ({
  ...frame,
  width,
  height: HEADER + width * ratio,
});

/** Pulls a window back inside a viewport that shrank: smaller first, keeping
 *  its ratio, then moved. */
export function fitFloating(frame: Frame, base: Size | undefined, viewport: Viewport): Frame {
  const ratio = ratioOf(frame, base);
  const widest = Math.min(viewport.width, (viewport.height - BAR_HEIGHT - HEADER) / ratio);
  return clamp(withWidth(frame, Math.min(frame.width, widest), ratio), viewport, LOOSE);
}

export type FloatingGesture = "move" | "corner";

/** A floating view's drags: the title bar moves it, the corner grip scales it
 *  with its ratio kept. The scale follows whichever axis the pointer moved
 *  further along, in proportion — so a drag along either axis grows or
 *  shrinks it, and the other axis follows. */
export function applyFloatingGesture(
  kind: FloatingGesture,
  start: Frame,
  dx: number,
  dy: number,
  viewport: Viewport,
  base: Size | undefined,
): Frame {
  if (kind === "move") {
    return clamp({ ...start, x: start.x + dx, y: start.y + dy }, viewport, LOOSE);
  }

  const ratio = ratioOf(start, base);
  const contentHeight = start.height - HEADER;
  const kx = (start.width + dx) / start.width;
  const ky = (contentHeight + dy) / contentHeight;
  const wanted = start.width * (Math.abs(kx - 1) >= Math.abs(ky - 1) ? kx : ky);
  const widest = Math.min(
    viewport.width - start.x,
    (viewport.height - BAR_HEIGHT - start.y - HEADER) / ratio,
  );
  // A window fitted smaller than the floor never jumps up to it on a touch,
  // and the viewport beats the floor — past its edge nobody can grab the grip.
  const narrowest = Math.min(MIN_CONTENT_WIDTH, start.width);
  return withWidth(start, Math.min(Math.max(wanted, narrowest), widest), ratio);
}

function toSize(value: unknown): Size | null {
  if (typeof value !== "object" || value === null) return null;
  const { width, height } = value as Record<string, unknown>;
  const ok = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;
  return ok(width) && ok(height) ? { width, height } : null;
}
