import type { Block } from "./types.ts";

/** An ordered list's numbers, one per block, computed at render time rather than
 *  stored so an insert never renumbers what follows. `0` for anything that is
 *  not an ordered item. **Each depth counts separately** — the sequence rules:
 *  `document-editing.md` §3 and "Indenting a list item". */
export function orderedListNumbers(blocks: Array<Block>): Array<number> {
  const numbers: Array<number> = [];
  // Index is depth. Truncated whenever a shallower block arrives, which is what
  // makes re-entering a level start over rather than resume.
  const counters: Array<number> = [];

  for (const block of blocks) {
    if (block.type !== "list") {
      counters.length = 0;
      numbers.push(0);
      continue;
    }

    counters.length = block.depth + 1;

    if (block.style !== "ordered") {
      // Ends the ordered run at this level only, so an outer numbered list
      // survives a bulleted child.
      counters[block.depth] = 0;
      numbers.push(0);
      continue;
    }

    counters[block.depth] = (counters[block.depth] ?? 0) + 1;
    numbers.push(counters[block.depth]!);
  }

  return numbers;
}
