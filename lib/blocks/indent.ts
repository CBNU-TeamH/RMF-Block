import type { TypeFields } from "./operations.ts";
import { idBeforeInOrder } from "./reorder.ts";
import type { Block, BlockId } from "./types.ts";

/** How deep a list may nest, and why 5: `docs/design/document-editing.md`. */
export const MAX_LIST_DEPTH = 5;

/** The depth a list block takes on when Tab or Shift+Tab is pressed, or `null`
 *  when the key should be left alone — not a list, at the limit, or nothing
 *  above to nest under. The rule and why indent is capped by the block above:
 *  `docs/design/document-editing.md`, "Indenting a list item". */
export function indentedDepth(
  blocks: Array<Block>,
  blockId: BlockId,
  direction: "in" | "out",
): number | null {
  const block = blocks.find((b) => b.id === blockId);
  if (!block || block.type !== "list") return null;

  if (direction === "out") {
    return block.depth > 0 ? block.depth - 1 : null;
  }

  const ceiling = Math.min(previousListDepth(blocks, blockId) + 1, MAX_LIST_DEPTH);
  const next = block.depth + 1;

  return next <= ceiling ? next : null;
}

/** The nearest list above `blockId`, or `-1` — which makes the ceiling 0, so the
 *  first item in a run cannot indent. By id, not index (`operations.ts`). */
function previousListDepth(blocks: Array<Block>, blockId: BlockId): number {
  const order = blocks.map((b) => b.id);
  const byId = new Map(blocks.map((b) => [b.id, b]));

  let cursor = idBeforeInOrder(order, blockId);
  while (cursor) {
    const previous = byId.get(cursor);
    if (previous?.type === "list") return previous.depth;

    // A non-list block ends the run (`document-editing.md`).
    if (previous) return -1;

    cursor = idBeforeInOrder(order, cursor);
  }

  return -1;
}

/** The fields a conversion should actually write. **A list changing style is not
 *  being re-parented**, and neither caller can name the depth itself — why, and
 *  why this is not inside `changeBlockType`: `docs/design/document-editing.md`,
 *  "A conversion must not flatten what it did not mention". */
export function preservingDepth(fields: TypeFields, current: Block | undefined): TypeFields {
  if (fields.type !== "list" || fields.depth !== undefined) return fields;
  if (current?.type !== "list") return fields;

  return { ...fields, depth: current.depth };
}
