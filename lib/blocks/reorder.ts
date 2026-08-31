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
