import { createChecklist, createList, createQuote, createText } from "./create.ts";
import type { Block, BlockType } from "./types.ts";

/** One table per block type, so a thirteenth cannot be half-done. Why a
 *  `Record` and not a `switch`, and why four surfaces rather than twelve types:
 *  `docs/design/document-editing.md`. */

/** How a block is edited and drawn — the only thing renderers branch on. */
export type BlockSurface =
  /** Edits through `TextBlockView`'s one `<textarea>`. */
  | "text"
  /** A file rendered in place, with the bytes behind a `fileId`. */
  | "embed"
  /** A pointer at another document or block. */
  | "link"
  /** Nothing to edit and nothing to fetch — the divider. */
  | "none";

/** The six types that carry text, derived from the union rather than listed. */
type TextBearing = Extract<Block, { text: string }>;

type Kind<K extends BlockType> = {
  /** Constrained against the union, which is what makes `isTextBearing` sound. */
  surface: K extends TextBearing["type"] ? "text" : Exclude<BlockSurface, "text">;
  /** What Enter at the end of this block leaves behind; omitted means plain text. */
  continuation?: (block: Extract<Block, { type: K }>) => Block;
};

export const BLOCK_KINDS: { [K in BlockType]: Kind<K> } = {
  text: { surface: "text" },
  heading: { surface: "text" },
  list: { surface: "text", continuation: (block) => createList(block.style, block.depth) },
  checklist: { surface: "text", continuation: createChecklist },
  quote: { surface: "text", continuation: createQuote },
  code: { surface: "text" },
  divider: { surface: "none" },
  file: { surface: "embed" },
  image: { surface: "embed" },
  pdf: { surface: "embed" },
  "doc-link": { surface: "link" },
  "block-link": { surface: "link" },
};

/** The six text-bearing types, as a type guard — the answer is the table's, so
 *  it cannot drift from it. */
export function isTextBearing(block: Block): block is TextBearing {
  return BLOCK_KINDS[block.type].surface === "text";
}

/** What continues after `block` when Enter splits it. `undefined` is a real
 *  caller state: the editor looks it up in an array a peer may have removed from. */
export function continuationBlock(block: Block | undefined): Block {
  if (!block) return createText();

  // Both sides come from `block.type` on the same value; TS cannot see that
  // across an index.
  const continuation = BLOCK_KINDS[block.type].continuation as
    | ((b: Block) => Block)
    | undefined;

  return continuation ? continuation(block) : createText();
}
