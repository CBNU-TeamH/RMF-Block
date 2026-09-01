import { createChecklist, createList, createQuote, createText } from "./create.ts";
import type { Block, BlockType } from "./types.ts";

/**
 * One table saying what each of the twelve block types *is*, so that adding a
 * thirteenth cannot be half-done.
 *
 * The problem this exists for was measured rather than guessed. Before it, a
 * new entry in the `Block` union produced exactly **one** compile error — in
 * `document.ts`'s `toStoredBlock` — while five other places carried on
 * compiling and then did the wrong thing at runtime: `readBlock` silently
 * *dropped* the block from the document, and three helpers in `editor.tsx`
 * fell back to plain text. `docs/design/document-editing.md` describes twelve
 * types as a settled schema; the code enforced one of them.
 *
 * The fix is the shape, not the content. A `Record` keyed by a union is
 * exhaustive — leave a key out and it does not compile — where a `switch` with
 * a `default` is not. `document.ts` already relied on that for `toStoredBlock`;
 * this puts everything else on the same footing.
 */

/**
 * How a block is edited and drawn, which is the only thing renderers need to
 * branch on. Four values rather than twelve, because the twelve types collapse
 * into four ways of behaving — and a renderer written against the *surface*
 * keeps working when a type is added to a surface it already handles.
 */
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
  /**
   * Constrained against the union, not free-form: a type that carries `text`
   * **must** be declared `"text"`, and one that does not **cannot** be. That is
   * what lets `isTextBearing` be a type guard whose runtime answer comes from
   * this table — without it the guard would be a promise this table could
   * quietly break.
   */
  surface: K extends TextBearing["type"] ? "text" : Exclude<BlockSurface, "text">;
  /**
   * What pressing Enter at the end of this block leaves behind. Omitted means
   * a plain text block, which is the right answer for everything except the
   * three types that "run": a list stays a list until you leave it.
   */
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

/**
 * The six text-bearing types, as a type guard.
 *
 * The runtime answer is the table's, so it cannot drift from it; the narrowing
 * is sound because `Kind`'s own type will not let a text-bearing type be
 * declared as anything but `"text"`.
 */
export function isTextBearing(block: Block): block is TextBearing {
  return BLOCK_KINDS[block.type].surface === "text";
}

/**
 * What continues after `block` when Enter splits it.
 *
 * `undefined` is a real caller state, not defensiveness — the editor looks the
 * original up in a `blocks` array a peer may already have removed from.
 */
export function continuationBlock(block: Block | undefined): Block {
  if (!block) return createText();

  // The lookup is `BlockType`-keyed while the callback wants its own narrowed
  // block, and TypeScript cannot see that the two agree across an index. They
  // do: both come from `block.type` on the same value.
  const continuation = BLOCK_KINDS[block.type].continuation as
    | ((b: Block) => Block)
    | undefined;

  return continuation ? continuation(block) : createText();
}
