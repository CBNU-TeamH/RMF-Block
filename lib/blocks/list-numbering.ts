import type { Block } from "./types.ts";

/**
 * An ordered list's numbers, one per block in `blocks`, computed here at
 * render time from position among *consecutive* `style: "ordered"` blocks —
 * never stored, so inserting or deleting a line never has to renumber
 * anything after it (`document-editing.md` §3, "List block"). `0` for every
 * block that is not itself an ordered list item — a renderer only reads the
 * number where it means something.
 *
 * Depth is ignored: nothing yet lets a list item nest, so every ordered
 * block runs through this at depth 0 in practice.
 */
export function orderedListNumbers(blocks: Array<Block>): Array<number> {
  const numbers: Array<number> = [];
  let count = 0;
  for (const block of blocks) {
    count = block.type === "list" && block.style === "ordered" ? count + 1 : 0;
    numbers.push(count);
  }
  return numbers;
}
