import { toStoredBlock, type BlockDocumentRoot } from "./document.ts";
import { editBlockText, type BlockArray } from "./operations.ts";
import { fillTable } from "./table.ts";
import type { Block } from "./types.ts";

/** Replaces every block with `next`, text and table cells included, inside the
 *  caller's one `doc.update`, so a version restore is one step on the undo
 *  stack (#185). The empty `yorkie.Text` nodes go in first and are filled
 *  through the re-read array: an edit needs its node in the tree, which the
 *  same update already gives it. */
export function replaceAllBlocks(root: BlockDocumentRoot, next: Array<Block>): void {
  root.blocks = next.map(toStoredBlock);
  for (const block of next) {
    if (block.type === "table") fillTable(root.blocks as BlockArray, block);
    const text = "text" in block ? block.text : "";
    if (text) editBlockText(root.blocks as BlockArray, block.id, 0, 0, text);
  }
}
