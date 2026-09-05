/** Where the floating chat window sits, as arithmetic rather than a component.
 *  The viewport is an argument, not a read of `window`, so every rule is
 *  checkable without a browser — an off-screen window cannot be dragged back. */

/** A ninth of the viewport by area — a third of each side. */
const DEFAULT_SCALE = 1 / 3;

/** Below this it stops being a conversation and starts being a scrollbar. */
export const MIN_WIDTH = 260;
export const MIN_HEIGHT = 220;

/** The launcher bar's height, and the only edge the window does not reach. It
 *  applies at every x — a limit that moved would feel like snagging on nothing. */
export const BAR_HEIGHT = 40;

export type Frame = { x: number; y: number; width: number; height: number };
export type Viewport = { width: number; height: number };

/** What a pointer drag on the chrome does. The resize kinds name the edge being
 *  pulled, because that decides which edge stays still. Three, not four — the
 *  top edge is the title bar and moves the window instead. */
export type GestureKind = "move" | "left" | "right" | "bottom";

/** `value` held between two bounds, tolerating a `hi` below `lo`. */
const between = (value: number, lo: number, hi: number) =>
  Math.min(Math.max(value, lo), Math.max(lo, hi));

/** Bottom right, above the bar that opened it. */
export function defaultFrame(viewport: Viewport): Frame {
  const width = Math.max(MIN_WIDTH, Math.round(viewport.width * DEFAULT_SCALE));
  const height = Math.max(MIN_HEIGHT, Math.round(viewport.height * DEFAULT_SCALE));

  return clamp(
    {
      x: viewport.width - width,
      y: viewport.height - BAR_HEIGHT - height,
      width,
      height,
    },
    viewport,
  );
}

/** Pulls a frame back inside the viewport, size before position — where it fits
 *  depends on how big it is. Below the minimum size the floor wins and the
 *  window overflows rather than collapsing. */
export function clamp(frame: Frame, viewport: Viewport): Frame {
  // The bar's strip is not part of the space a window may occupy, so it comes
  // off the height before anything else is decided.
  const usableHeight = viewport.height - BAR_HEIGHT;

  const width = Math.min(Math.max(frame.width, MIN_WIDTH), Math.max(MIN_WIDTH, viewport.width));
  const height = Math.min(Math.max(frame.height, MIN_HEIGHT), Math.max(MIN_HEIGHT, usableHeight));

  return {
    width,
    height,
    x: Math.min(Math.max(frame.x, 0), Math.max(0, viewport.width - width)),
    y: Math.min(Math.max(frame.y, 0), Math.max(0, usableHeight - height)),
  };
}

/** The frame a drag produces. The moving edge is clamped as a **position**,
 *  never the width as a size — clamping the width slides the whole window right
 *  once it can get no narrower, instead of stopping the edge. */
export function applyGesture(
  kind: GestureKind,
  start: Frame,
  dx: number,
  dy: number,
  viewport: Viewport,
): Frame {
  if (kind === "move") {
    return clamp({ ...start, x: start.x + dx, y: start.y + dy }, viewport);
  }

  const right = start.x + start.width;
  const bottom = start.y + start.height;
  const floor = viewport.height - BAR_HEIGHT;

  // One edge moves; `y` never does, because the top edge is the title bar.
  switch (kind) {
    case "left": {
      const left = between(start.x + dx, 0, right - MIN_WIDTH);
      return { ...start, x: left, width: right - left };
    }
    case "right":
      return { ...start, width: between(right + dx, start.x + MIN_WIDTH, viewport.width) - start.x };
    case "bottom":
      return { ...start, height: between(bottom + dy, start.y + MIN_HEIGHT, floor) - start.y };
  }
}

/** A frame read back from storage, or null. `localStorage` holds whatever was
 *  last written to that key — another version of this app, devtools, a
 *  half-finished write — and this check keeps `NaN` out of a `style`. */
export function parseFrame(raw: string | null): Frame | null {
  if (!raw) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;

    const frame = value as Record<string, unknown>;
    const numbers = [frame.x, frame.y, frame.width, frame.height];
    if (!numbers.every((n) => typeof n === "number" && Number.isFinite(n))) return null;

    return {
      x: frame.x as number,
      y: frame.y as number,
      width: frame.width as number,
      height: frame.height as number,
    };
  } catch {
    return null;
  }
}
