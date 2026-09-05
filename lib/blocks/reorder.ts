/**
 * Pure helpers for "what comes before what" in the block list's current
 * order — kept apart from the DOM (`editor.tsx`'s drag-and-drop, once that
 * lands) the same way `text-surface.ts` keeps IME/diff math apart from the
 * `<textarea>`, tested without a browser.
 */

/**
 * The id right before `targetId`, or `null` if it is first or absent — order is
 * the one thing `blocks` state is reliable for. Merge's "previous block" and
 * reorder's "insert before target" are the same question.
 */
export function idBeforeInOrder(order: Array<string>, targetId: string): string | null {
  const index = order.indexOf(targetId);
  if (index <= 0) return null;
  return order[index - 1] ?? null;
}

/**
 * The id currently right after `targetId` in `order`, or `null` if
 * `targetId` is last (or absent). Mirrors `idBeforeInOrder` — used by
 * arrow-key navigation's ArrowDown to find the next block to focus.
 */
export function idAfterInOrder(order: Array<string>, targetId: string): string | null {
  const index = order.indexOf(targetId);
  if (index === -1 || index === order.length - 1) return null;
  return order[index + 1] ?? null;
}

/**
 * Whether a drop at `clientY` lands before `target` (vs. after) — compared
 * against the target's own vertical midpoint, not its top edge, so a drop
 * anywhere in the bottom half of a block means "after this one."
 */
export function dropsBeforeTarget(clientY: number, rectTop: number, rectHeight: number): boolean {
  return clientY < rectTop + rectHeight / 2;
}

/**
 * Where a drop on `targetId` puts `draggedId`, or `null` when it puts it
 * nowhere — onto itself, or into the slot it already occupies. Wrapped so a
 * legitimate `null` ("insert at the front") stays distinct from "no move".
 *
 * One rule, two callers on purpose: the insertion line is drawn only where this
 * returns a destination. Split in two they drifted, and the line promised drops
 * that did nothing.
 */
export function dropDestination(
  order: Array<string>,
  draggedId: string,
  targetId: string,
  before: boolean,
): { afterId: string | null } | null {
  if (draggedId === targetId) return null;

  const afterId = before ? idBeforeInOrder(order, targetId) : targetId;
  if (afterId === draggedId) return null;
  if (afterId === idBeforeInOrder(order, draggedId)) return null;

  return { afterId };
}
