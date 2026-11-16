import { parsePaste, pastedBlock } from "./paste.ts";
import type { Block } from "./types.ts";

/** A Markdown file's blocks: read as a paste, without the blank lines a file puts
 *  between paragraphs — in a block document the blocks are the spacing. */
export function blocksFromMarkdown(text: string): Array<Block> {
  return parsePaste(text)
    .filter((line) => line.fields.type !== "text" || line.text.trim() !== "")
    .map(pastedBlock);
}
