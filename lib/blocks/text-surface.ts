/**
 * The pure half of the block editor's text surface — everything decided in
 * `docs/design/document-editing.md`'s "Editing surface" section that does not
 * need a DOM to run. Kept apart from the `<textarea>` component so it is
 * tested without a browser, the way `lib/presence/roster.ts` is.
 *
 * The two path readers at the bottom stretch that description a little: they
 * are about Yorkie's op paths rather than about text. They live here because
 * they are read together, in the same loop over one change event, and because
 * a decision with three documented edge cases belongs somewhere it can be
 * tested rather than inline in an effect.
 */

/** The smallest edit that turns `oldStr` into `newStr` — common prefix and suffix trimmed off. */
export function diffRange(
  oldStr: string,
  newStr: string,
): { from: number; to: number; value: string } {
  let start = 0;
  const maxStart = Math.min(oldStr.length, newStr.length);
  while (start < maxStart && oldStr[start] === newStr[start]) start += 1;

  let oldEnd = oldStr.length;
  let newEnd = newStr.length;
  while (oldEnd > start && newEnd > start && oldStr[oldEnd - 1] === newStr[newEnd - 1]) {
    oldEnd -= 1;
    newEnd -= 1;
  }

  return { from: start, to: oldEnd, value: newStr.slice(start, newEnd) };
}

/**
 * Where a caret at `pos` should land once a remote edit (`from`/`to`/the
 * inserted text's length) lands elsewhere in the same string.
 *
 * `null` means the edit overlapped the caret itself — measured as the one
 * case worth naming rather than guessing at: the caller decides what to do
 * (`patchRange` logs it), this only ever reports what it actually knows.
 */
export function shiftCaret(
  pos: number,
  op: { from: number; to: number; insertedLength: number },
): number | null {
  const delta = op.insertedLength - (op.to - op.from);
  if (pos >= op.to) return pos + delta;
  if (pos <= op.from) return pos;
  return null;
}

/**
 * Reads the array index out of a text-edit's path, e.g. `$.blocks.3.content.text`
 * → `3`. Yorkie's paths are positional, not by block id (`document-editing.md`,
 * "Subscribing to remote changes") — resolving the index back to an id has to
 * happen against the document's *current* array, at the moment the event
 * arrives, or a block that has moved since routes to the wrong handler.
 */
export function blockIndexFromEditPath(path: string): number | null {
  const match = /^\$\.blocks\.(\d+)\.content\.text$/.exec(path);
  if (!match) return null;
  return Number(match[1]);
}

/**
 * Whether a remote operation means the rendered block list is stale.
 *
 * True for anything touching the array itself or a field inside one block:
 *
 * - `$.blocks` — a split, merge or reorder (`add`, `remove`, `move`).
 * - `$.blocks.<i>` — a markdown-shortcut conversion setting the block's `type`.
 * - `$.blocks.<i>.content` — the same conversion setting `level`, `style` or
 *   `checked`. Missing this one made a peer's heading conversion invisible
 *   until some later, unrelated edit happened to recompute for its own reasons.
 *
 * Text edits do *not* come through here — they are routed to the block's own
 * textarea by `blockIndexFromEditPath` instead, because there the DOM node to
 * patch is known and rebuilding the whole list would throw away the caret.
 * Everything else is recomputed rather than patched: there is no single node
 * whose value moved, the list itself is wrong.
 *
 * **Open question, deliberately not changed while extracting this:** a peer
 * seeding a brand-new document assigns the whole array (`root.blocks = [...]`),
 * and whether Yorkie reports that as `$.blocks` or as a set on `$` has not been
 * measured. If it is the latter, this returns false and that peer's seed is not
 * drawn until something else happens — which the seeding race in `#42` would
 * usually hide. Worth measuring before anyone relies on it.
 */
export function touchesBlockList(path: string): boolean {
  return path === "$.blocks" || path.startsWith("$.blocks.");
}
