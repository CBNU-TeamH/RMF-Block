import type { JSONArray, Text } from "@yorkie-js/sdk";

import type { StoredBlock, StoredContent } from "./document.ts";
import type { BlockId, HeadingLevel, ListStyle } from "./types.ts";

/** Every change the editor can make to a document's blocks (FR-022-01~04).
 *  **Each runs inside a `doc.update()` callback** and opens no transaction of
 *  its own — a split is an insert and two text edits, and half a split is worse
 *  than none. A block is named by `id`, never index; `set` never touches text.
 *  Why both, and the measurements: `docs/design/document-editing.md`. */

/** The live array as Yorkie hands it over inside `doc.update()`. */
export type BlockArray = JSONArray<StoredBlock>;

export class BlockNotFoundError extends Error {
  constructor(blockId: BlockId) {
    super(`no block with id ${blockId}`);
  }
}

/** Yorkie addresses elements by `TimeTicket` and we address them by `id`; this
 *  is the only place the two meet. The scan stays linear on purpose — an
 *  id→ticket index would be a second thing to keep true on every remote change. */
function elementOf(blocks: BlockArray, blockId: BlockId) {
  for (const element of blocks.elements()) {
    // The wrapped block: readable as one, and carrying the `getID()` Yorkie needs.
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

/** Puts `block` after `afterId`, or at the very start when that is `null` —
 *  which is what "add a block above this one" means for the first block. */
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

/** Moves a block after `afterId`, or to the front when that is `null`. The block
 *  keeps its identity and its text through the move — see the document-editing
 *  doc's Verification items 2 and 3 for what was measured. */
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

/** The one way text changes (FR-022-02) — an insert is a zero-width range, a
 *  delete an empty value. Offsets are safe where block indices are not:
 *  `yorkie.Text` resolves them to a position at edit time, not a number. */
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

/** Changes a block's type in place (FR-022-02) — what a markdown marker and the
 *  `/` menu both do. Why in place, and why the outgoing fields clear in the same
 *  update: `docs/design/document-editing.md`. */
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
