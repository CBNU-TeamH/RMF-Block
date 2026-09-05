/** The DOM-free half of the editing surface (`docs/design/document-editing.md`),
 *  testable without a browser. The two path readers at the bottom sit here
 *  because one loop over a change event reads both. */

/** One replacement inside a block's text. Narrower than Yorkie's `EditOpInfo`
 *  on purpose, so a split reaches the textarea by the road a remote edit takes
 *  (#59). */
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

/** Where a caret at `pos` lands after an edit elsewhere in the string. `null`
 *  means the edit overlapped the caret — the one case this leaves to the caller. */
export function shiftCaret(
  pos: number,
  op: { from: number; to: number; insertedLength: number },
): number | null {
  const delta = op.insertedLength - (op.to - op.from);
  if (pos >= op.to) return pos + delta;
  if (pos <= op.from) return pos;
  return null;
}

/** `$.blocks.3.content.text` → `3`. Positional, so the caller must resolve it to
 *  an id against the array as it is when the event arrives — see the doc's
 *  "Subscribing to remote changes". */
export function blockIndexFromEditPath(path: string): number | null {
  const match = /^\$\.blocks\.(\d+)\.content\.text$/.exec(path);
  if (!match) return null;
  return Number(match[1]);
}

/** Whether a remote operation means the rendered block list is stale; the paths
 *  it accepts are enumerated in this module's tests. Text edits deliberately go
 *  elsewhere — a full rebuild would cost the caret. One unmeasured case is in
 *  the doc's Open questions. */
export function touchesBlockList(path: string): boolean {
  return path === "$.blocks" || path.startsWith("$.blocks.");
}
