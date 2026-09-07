/** Order questions, kept apart from the DOM so they test without a browser.
 *  What a drop means: `docs/design/document-editing.md`. */

/** The id right before `targetId`, or `null` if it is first or absent. */
export function idBeforeInOrder(order: Array<string>, targetId: string): string | null {
  const index = order.indexOf(targetId);
  if (index <= 0) return null;
  return order[index - 1] ?? null;
}

/** The mirror of `idBeforeInOrder`; ArrowDown's next block to focus. */
export function idAfterInOrder(order: Array<string>, targetId: string): string | null {
  const index = order.indexOf(targetId);
  if (index === -1 || index === order.length - 1) return null;
  return order[index + 1] ?? null;
}

/** Whether a drop at `clientY` lands before the target — its midpoint, not its
 *  top edge. */
export function dropsBeforeTarget(clientY: number, rectTop: number, rectHeight: number): boolean {
  return clientY < rectTop + rectHeight / 2;
}

/** Where a drop puts `draggedId`, or `null` for a drop that moves nothing. The
 *  wrapper keeps a legitimate `null` ("insert at the front") distinct from that.
 *  The insertion line must be drawn from this same call — why:
 *  `docs/design/document-editing.md`. */
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
