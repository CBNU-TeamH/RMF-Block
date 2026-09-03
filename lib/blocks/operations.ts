import type { JSONArray, Text } from "@yorkie-js/sdk";

import type { StoredBlock, StoredContent } from "./document.ts";
import type { BlockId, HeadingLevel, ListStyle } from "./types.ts";

/**
 * Every change the editor can make to a document's blocks (FR-022-01~04).
 *
 * Each function runs **inside** a `doc.update()` callback and takes the live
 * `root.blocks` array. They do not open their own transaction, because the
 * caller often needs several of them to land together — splitting a block is an
 * insert and two text edits, and a half-applied split is a worse document than
 * an unsplit one.
 *
 * Two rules run through all of it, both of them measured rather than assumed
 * (`notes/yorkie-block-model/`):
 *
 * 1. **Blocks are named by id, never by index.** An index is a fact about one
 *    replica at one moment; a peer inserting above you shifts it. Yorkie's own
 *    operations carry `TimeTicket`s for the same reason and never send an
 *    index at all.
 * 2. **`set` and `edit` never mix.** Primitives (`type`, `level`, `style`,
 *    `depth`, `checked`) are assigned and resolve last-write-wins; text is
 *    edited through `yorkie.Text` and merges character by character. Assigning
 *    a string over a `Text` would erase a peer's keystrokes instead of merging
 *    them.
 */

/** The live array as Yorkie hands it over inside `doc.update()`. */
export type BlockArray = JSONArray<StoredBlock>;

export class BlockNotFoundError extends Error {
  constructor(blockId: BlockId) {
    super(`no block with id ${blockId}`);
  }
}

/**
 * Yorkie addresses elements by `TimeTicket`, and we address them by our own
 * `id`. This is the only place the two meet.
 *
 * The scan is linear, and stays linear on purpose: a document people actually
 * read is not long enough for that to matter, and an id→ticket index would be a
 * second thing to keep true across every remote change.
 */
function elementOf(blocks: BlockArray, blockId: BlockId) {
  for (const element of blocks.elements()) {
    // `element` is the wrapped block: readable as a block, and carrying the
    // `getID()` Yorkie needs.
    if ((element as unknown as StoredBlock).id === blockId) return element;
  }

  throw new BlockNotFoundError(blockId);
}

function contentOf(blocks: BlockArray, blockId: BlockId): StoredContent {
  const block = elementOf(blocks, blockId) as unknown as StoredBlock;

  if (!block.content) {
    throw new Error(`block ${blockId} has no content to edit`);
  }

  return block.content;
}

/**
 * Puts `block` directly after `afterId`, or at the very start when that is
 * `null` — which is what "add a block above this one" means for the first block
 * in the document.
 */
export function insertBlockAfter(
  blocks: BlockArray,
  afterId: BlockId | null,
  block: StoredBlock,
): void {
  if (afterId === null) {
    // `unshift` is not one of the methods Yorkie's array proxy implements — it
    // throws "is not a function" rather than failing a type check, so it has to
    // be avoided rather than caught.
    if (blocks.length === 0) {
      blocks.push(block);
      return;
    }

    blocks.insertBefore(blocks.getElementByIndex(0).getID(), block);
    return;
  }

  blocks.insertAfter(elementOf(blocks, afterId).getID(), block);
}

/** Appends to the end of the document. */
export function appendBlock(blocks: BlockArray, block: StoredBlock): void {
  blocks.push(block);
}

export function removeBlock(blocks: BlockArray, blockId: BlockId): void {
  blocks.deleteByID(elementOf(blocks, blockId).getID());
}

/**
 * Moves a block after `afterId`, or to the front when that is `null`.
 *
 * The block keeps its identity: Yorkie's array separates an element from the
 * position it occupies, so a move rewrites the position and leaves the element —
 * and the `yorkie.Text` inside it — untouched. Measured: a peer typing into the
 * block while it moves keeps their characters.
 *
 * Two people moving the same block at once resolve last-write-wins on its
 * position. One of them sees their move undone, which is the honest outcome —
 * a block cannot be in two places.
 */
export function moveBlockAfter(
  blocks: BlockArray,
  afterId: BlockId | null,
  blockId: BlockId,
): void {
  const target = elementOf(blocks, blockId).getID();

  if (afterId === null) {
    blocks.moveFront(target);
    return;
  }

  blocks.moveAfter(elementOf(blocks, afterId).getID(), target);
}

/**
 * The one way text changes (FR-022-02). `from`/`to` are character offsets in
 * the block's current text, and `value` replaces what they span — so an insert
 * is a zero-width range and a delete is an empty value.
 *
 * Offsets are safe here in a way block indices are not: `yorkie.Text` resolves
 * them against its own nodes at the moment of the edit and carries a position,
 * not a number, in the operation it sends.
 */
export function editBlockText(
  blocks: BlockArray,
  blockId: BlockId,
  from: number,
  to: number,
  value: string,
): void {
  const text = contentOf(blocks, blockId).text as Text | undefined;

  if (!text) {
    throw new Error(`block ${blockId} holds no text`);
  }

  text.edit(from, to, value);
}

/** The primitives a block type owns, minus the text every one of them keeps. */
/** The fields a conversion takes on, by target type. Exported because the `/`
 *  menu's items name one of these (`lib/blocks/slash-menu.ts`). */
export type TypeFields =
  | { type: "text" }
  | { type: "heading"; level: HeadingLevel }
  | { type: "list"; style: ListStyle; depth?: number }
  | { type: "checklist"; checked?: boolean }
  | { type: "quote" }
  | { type: "code" };

/** Every field any text-bearing type can own. What is not taken on is dropped. */
const OWNED_FIELDS = ["level", "style", "depth", "checked"] as const;

/**
 * Changes a block's type in place — what typing `- ` at the start of a paragraph
 * does, and what the block menu does.
 *
 * In place, and not delete-then-create, for two reasons. The block keeps its
 * `id`, so occupancy (FR-022-06) and any block-link pointing at it still
 * resolve. And it keeps its `yorkie.Text`, so a peer typing in it at that moment
 * keeps what they typed — a rebuild loses it, measured.
 *
 * The fields the outgoing type owned are deleted in the same call. Two people
 * converting one block at once leave the loser's fields behind — `type` is a
 * single LWW primitive and converges, but the fields around it were separate
 * writes and all survive. Clearing here means that litter never outlives the
 * next conversion, and it rides a write the person already asked for rather
 * than a sweep that would race real edits of its own
 * (`docs/design/document-editing.md`).
 */
export function changeBlockType(
  blocks: BlockArray,
  blockId: BlockId,
  fields: TypeFields,
): void {
  const block = elementOf(blocks, blockId) as unknown as StoredBlock;
  const content = contentOf(blocks, blockId);

  const taking = new Set<string>(Object.keys(fields).filter((k) => k !== "type"));

  for (const field of OWNED_FIELDS) {
    if (!taking.has(field)) delete content[field];
  }

  if (fields.type === "heading") {
    content.level = fields.level;
  } else if (fields.type === "list") {
    content.style = fields.style;
    content.depth = Math.max(0, Math.trunc(fields.depth ?? 0));
  } else if (fields.type === "checklist") {
    content.checked = fields.checked ?? false;
  }

  // Last, so a peer that sees only part of this update still sees a block whose
  // type matches fields that are already in place.
  block.type = fields.type;
}
