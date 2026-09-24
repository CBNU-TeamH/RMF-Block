import { clamp, toFrame, type Frame, type Viewport } from "../chat/window-frame.ts";

/** The floating views one viewer has open (UC-070), as arithmetic on a list.
 *  Kept in `localStorage` — which blocks this person pinned, and where, is
 *  worth nothing to anyone else and never sent anywhere. */

export const STORAGE_KEY = "rmf-floating-views";

export type BlockRef = { documentId: string; blockId: string };

export type FloatingView = BlockRef & { frame: Frame };

/** Wireframe size (`docs/ui/app-shell/app-shell.jsx`, `FloatedMirror`), raised
 *  to the window floor `clamp` enforces anyway. */
const WIDTH = 320;
const HEIGHT = 220;
/** How far each new window steps down-left from the last, so a second one never
 *  lands exactly on top of the first and hides it. */
const CASCADE = 24;
/** Clear of the workspace header. */
const TOP = 56;

const sameBlock = (a: BlockRef, b: BlockRef) =>
  a.documentId === b.documentId && a.blockId === b.blockId;

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
    if (typeof entry?.documentId !== "string" || typeof entry.blockId !== "string") continue;
    const frame = toFrame(entry.frame);
    if (!frame) continue;
    const view = { documentId: entry.documentId, blockId: entry.blockId, frame };
    if (!views.some((open) => sameBlock(open, view))) views.push(view);
  }
  return views;
}

/** Adds a view of `ref`, or leaves the list alone if that block is already
 *  open — two windows mirroring one block show nothing the first did not. */
export function openView(
  views: Array<FloatingView>,
  ref: BlockRef,
  viewport: Viewport,
): Array<FloatingView> {
  if (views.some((view) => sameBlock(view, ref))) return views;

  const step = views.length * CASCADE;
  const frame = clamp(
    { x: viewport.width - WIDTH - CASCADE - step, y: TOP + step, width: WIDTH, height: HEIGHT },
    viewport,
  );
  return [...views, { ...ref, frame }];
}

export function closeView(views: Array<FloatingView>, ref: BlockRef): Array<FloatingView> {
  return views.filter((view) => !sameBlock(view, ref));
}

export function moveView(
  views: Array<FloatingView>,
  ref: BlockRef,
  frame: Frame,
): Array<FloatingView> {
  return views.map((view) => (sameBlock(view, ref) ? { ...view, frame } : view));
}
