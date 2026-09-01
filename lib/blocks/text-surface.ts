/**
 * The pure half of the block editor's text surface — everything decided in
 * `docs/design/document-editing.md`'s "Editing surface" section that does not
 * need a DOM to run. Kept apart from the `<textarea>` component so it is
 * tested without a browser, the way `lib/presence/roster.ts` is.
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
