/**
 * The DOM-free half of the editing surface (`docs/design/document-editing.md`),
 * kept apart from the `<textarea>` so it can be tested without a browser.
 *
 * The two path readers at the bottom are about Yorkie's op paths rather than
 * text; they live here because one loop over a change event reads both.
 */

/**
 * One replacement inside a block's text: swap `[from, to)` for `value.content`.
 *
 * Narrower than Yorkie's `EditOpInfo` (which is assignable to it) on purpose —
 * a split or merge has to reach the textarea by the same road a remote edit
 * does, or the DOM and the document drift apart (#59).
 */
export type TextPatch = {
  from: number;
  to: number;
  value: { content: string };
};

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
 * Where a caret at `pos` lands once an edit lands elsewhere in the same string.
 *
 * `null` means the edit overlapped the caret itself — the one case this refuses
 * to guess at, leaving it to the caller.
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
 * The array index in a text-edit's path: `$.blocks.3.content.text` → `3`.
 *
 * Yorkie paths are positional, so the caller must resolve this back to an id
 * against the array *as it is when the event arrives* — see the doc's
 * "Subscribing to remote changes".
 */
export function blockIndexFromEditPath(path: string): number | null {
  const match = /^\$\.blocks\.(\d+)\.content\.text$/.exec(path);
  if (!match) return null;
  return Number(match[1]);
}

/**
 * Whether a remote operation means the rendered block list is stale. The paths
 * it accepts, and why each one matters, are enumerated in this module's tests.
 *
 * Text edits deliberately do not come through here — they route to one block's
 * textarea instead, where the node to patch is known and a full rebuild would
 * cost the caret.
 *
 * **Open question, unmeasured:** a peer seeding a brand-new document assigns
 * the whole array, and whether Yorkie reports that as `$.blocks` or as a set on
 * `$` has never been checked. If the latter, this returns false and that seed
 * is not drawn until something else happens — which `#42`'s race usually hides.
 */
export function touchesBlockList(path: string): boolean {
  return path === "$.blocks" || path.startsWith("$.blocks.");
}
