/**
 * Where the floating chat window sits, as arithmetic rather than as a component.
 *
 * The viewport comes in as an argument instead of being read from `window`, so
 * every rule here — the default placement, the minimum size, staying reachable —
 * can be checked without a browser. That matters more than usual for this
 * particular code: a window that ends up off-screen cannot be dragged back, and
 * that is a bug you only meet at a viewport size nobody happened to try.
 */

/** A ninth of the viewport by area — a third of each side. */
const DEFAULT_SCALE = 1 / 3;

/** Below this it stops being a conversation and starts being a scrollbar. */
export const MIN_WIDTH = 260;
export const MIN_HEIGHT = 220;

/** The gap kept from the viewport edge. */
const MARGIN = 12;

/** Height of the bar that opens the window, which it sits above by default. */
const BAR_HEIGHT = 40;

export type Frame = { x: number; y: number; width: number; height: number };
export type Viewport = { width: number; height: number };

/** Bottom right, above the bar that opened it. */
export function defaultFrame(viewport: Viewport): Frame {
  const width = Math.max(MIN_WIDTH, Math.round(viewport.width * DEFAULT_SCALE));
  const height = Math.max(MIN_HEIGHT, Math.round(viewport.height * DEFAULT_SCALE));

  return clamp(
    {
      x: viewport.width - width - MARGIN,
      y: viewport.height - height - BAR_HEIGHT - MARGIN,
      width,
      height,
    },
    viewport,
  );
}

/**
 * Pulls a frame back inside the viewport.
 *
 * Size is settled before position, because where a window fits depends on how
 * big it is — clamping the corner first and then shrinking would leave a gap it
 * never moves back into.
 *
 * A viewport too small for the minimum size is not an error: the size floor
 * wins and the window overflows rather than collapsing into something unusable.
 */
export function clamp(frame: Frame, viewport: Viewport): Frame {
  const width = Math.min(Math.max(frame.width, MIN_WIDTH), Math.max(MIN_WIDTH, viewport.width - MARGIN * 2));
  const height = Math.min(Math.max(frame.height, MIN_HEIGHT), Math.max(MIN_HEIGHT, viewport.height - MARGIN * 2));

  return {
    width,
    height,
    x: Math.min(Math.max(frame.x, MARGIN), Math.max(MARGIN, viewport.width - width - MARGIN)),
    y: Math.min(Math.max(frame.y, MARGIN), Math.max(MARGIN, viewport.height - height - MARGIN)),
  };
}

/** The frame a drag or a resize produces, given how far the pointer has moved. */
export function applyGesture(
  kind: "move" | "resize",
  start: Frame,
  dx: number,
  dy: number,
  viewport: Viewport,
): Frame {
  return clamp(
    kind === "move"
      ? { ...start, x: start.x + dx, y: start.y + dy }
      : { ...start, width: start.width + dx, height: start.height + dy },
    viewport,
  );
}

/**
 * A frame read back from storage, or null for anything that is not one.
 *
 * `localStorage` holds whatever was last written to that key, which is not
 * necessarily a frame: another version of this app, a person with devtools, a
 * half-finished write. A shape check here is what keeps `NaN` out of a `style`.
 */
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
