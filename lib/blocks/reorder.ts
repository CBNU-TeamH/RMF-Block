/**
 * Pure helpers for "what comes before what" in the block list's current
 * order — kept apart from the DOM (`editor.tsx`'s drag-and-drop, once that
 * lands) the same way `text-surface.ts` keeps IME/diff math apart from the
 * `<textarea>`, tested without a browser.
 */

/**
 * The id currently right before `targetId` in `order`, or `null` if
 * `targetId` is first (or absent). This is "what comes before this id right
 * now" — the one thing an ordered id list is reliable for, unlike a
 * block's `text`, which per-block textareas never write back into `blocks`
 * state (`editor.tsx`'s own comment on `liveTextOf`). Used both by merge
 * (the "previous block" a Backspace joins into) and, later, by reorder
 * ("insert before target" resolves to `moveBlockAfter`'s `afterId` this
 * way) — both are the same question about order.
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
 * Where a drop on `targetId` puts `draggedId` — or `null` when it puts it
 * nowhere: dropped onto itself, or into the slot it already occupies (either
 * side of the neighbour it is already next to). The result is
 * `moveBlockAfter`'s `afterId`, wrapped so that a legitimate `null` ("insert
 * at the front") stays distinguishable from "no move at all".
 *
 * One rule, two callers, on purpose: `editor.tsx` draws its insertion line
 * only where this returns a destination and moves the block only where this
 * returns a destination. Split across two places they drifted, and the line
 * promised drops that silently did nothing.
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
