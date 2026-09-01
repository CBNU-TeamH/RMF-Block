import { Text } from "@yorkie-js/sdk";

import type {
  Block,
  BlockType,
  HeadingLevel,
  ListStyle,
} from "./types.ts";

/**
 * The bridge between what Yorkie holds and what the app reads.
 *
 * `types.ts` describes a block as the UI wants it: a union narrowed by `type`,
 * where a heading certainly has a `level`. Storage cannot promise that, and this
 * file is where the difference is dealt with rather than assumed away.
 */

/**
 * A block as it actually sits in the document. Every field beyond `id` and
 * `type` is optional, and that is not laziness about typing — it is what
 * concurrent editing leaves behind.
 *
 * Two clients converting the same block at the same moment each write their own
 * type's fields. `type` is one LWW primitive so it converges on one winner, but
 * the fields around it were separate writes and all of them survive: a block can
 * read `heading` while still carrying a `style` from the list conversion that
 * lost. The reverse is possible too — nothing in the CRDT guarantees a heading
 * has a `level`, only our own discipline about writing them together.
 *
 * Nothing validates this on the way in, either. Yorkie is published on the LAN
 * with no auth webhook (`docs/design/api.md` §2 has no implementation), so the
 * document is writable by anything that can reach port 8080.
 */
export type StoredBlock = {
  id: string;
  type: BlockType;
  content?: StoredContent;
};

/** The union of every field any block type can hold, all optional. */
export type StoredContent = {
  text?: Text;
  level?: HeadingLevel;
  style?: ListStyle;
  depth?: number;
  checked?: boolean;
  fileId?: string;
  fileName?: string;
  fileType?: string;
  size?: number;
  documentId?: string;
  blockId?: string;
};

/** The document root. One key today; the chat singleton is its own document. */
export type BlockDocumentRoot = {
  blocks: Array<StoredBlock>;
};

/**
 * A heading that lost its `level` to a race still has to render as something,
 * and the largest is the one a person most likely meant — it is what a bare
 * "make this a heading" produces.
 */
const FALLBACK_HEADING_LEVEL: HeadingLevel = 1;

/** Same reasoning: an unordered list is the plainer of the two. */
const FALLBACK_LIST_STYLE: ListStyle = "unordered";

const textOf = (content: StoredContent | undefined): string =>
  content?.text?.toString() ?? "";

/**
 * Turns the document's blocks into the strict shape the UI reads.
 *
 * This is the only place a missing field is decided about. Falling back rather
 * than throwing is deliberate: the alternative to a heading rendering at the
 * wrong level is the whole document failing to render, and one racing pair of
 * conversions is not worth that. Every fallback is a constant above, named, so
 * the choice is visible rather than buried in a `??`.
 *
 * A block whose `type` is not one of the twelve is dropped. It cannot be drawn —
 * there is no renderer for a type this build has never heard of — and guessing
 * would misrepresent it. Dropping is a real cost, so it is written down here:
 * the block stays in the document and reappears the moment a build that knows
 * the type reads it.
 */
export function readBlocks(blocks: Array<StoredBlock | null>): Array<Block> {
  const result: Array<Block> = [];

  for (const stored of blocks) {
    const block = readBlock(stored);
    if (block) result.push(block);
  }

  return result;
}

/**
 * `null` is dropped like any other malformed entry, not treated as a crash.
 * Yorkie's `JSONArray` accepts `null` as a plain element — nothing here writes
 * one, but the LAN can (`docs/design/api.md` §2) — and destructuring it before
 * this check threw before `readBlocks`'s per-block resilience ever applied.
 */
function readBlock(stored: StoredBlock | null): Block | null {
  if (!stored) return null;

  const { id, content } = stored;

  switch (stored.type) {
    case "text":
      return { id, type: "text", text: textOf(content) };

    case "heading":
      return {
        id,
        type: "heading",
        level: content?.level ?? FALLBACK_HEADING_LEVEL,
        text: textOf(content),
      };

    case "list":
      return {
        id,
        type: "list",
        style: content?.style ?? FALLBACK_LIST_STYLE,
        // A negative depth would indent backwards out of the document.
        depth: Math.max(0, Math.trunc(content?.depth ?? 0)),
        text: textOf(content),
      };

    case "checklist":
      return {
        id,
        type: "checklist",
        checked: content?.checked === true,
        text: textOf(content),
      };

    case "quote":
      return { id, type: "quote", text: textOf(content) };

    case "code":
      return { id, type: "code", text: textOf(content) };

    case "divider":
      return { id, type: "divider" };

    // The five below cannot be created yet, so any that turn up came from
    // somewhere this build did not write. They are read anyway rather than
    // dropped: the fields are simple, and a document that renders half its
    // blocks is worse than one that renders a file block with a blank name.
    case "file":
      return {
        id,
        type: "file",
        fileId: content?.fileId ?? "",
        fileName: content?.fileName ?? "",
        fileType: content?.fileType ?? "",
        size: content?.size ?? 0,
      };

    case "image":
    case "pdf":
      return {
        id,
        type: stored.type,
        fileId: content?.fileId ?? "",
        fileName: content?.fileName ?? "",
        size: content?.size ?? 0,
      };

    case "doc-link":
      return { id, type: "doc-link", documentId: content?.documentId ?? "" };

    case "block-link":
      return {
        id,
        type: "block-link",
        documentId: content?.documentId ?? "",
        blockId: content?.blockId ?? "",
      };

    default: {
      // Two different failures share this branch, and only one of them is
      // allowed to be silent. A `type` that is not in the union at all can
      // arrive at runtime — Yorkie is on the LAN with no schema enforcement
      // (`docs/design/api.md` §2) — and dropping that block is the documented
      // behaviour above. A type that *is* in the union but has no `case` is a
      // different thing entirely: a block this build knows about and forgot to
      // read. `never` separates them, because it only holds while every member
      // is handled — add a thirteenth type and this line stops compiling.
      const unhandled: never = stored.type;
      void unhandled;

      return null;
    }
  }
}

/**
 * The reverse of `readBlock`: what a `create.ts` factory's output has to become
 * before `operations.ts` will touch it.
 *
 * A block's text turns into a live, empty `yorkie.Text` here, never the plain
 * string a `Block` carries — assigning the string itself would be exactly the
 * mistake this file's own top comment warns against, and the one `create.ts`
 * avoids by returning empty text and leaving the first `edit()` to the caller.
 * `toStoredBlock` only creates the CRDT; filling it is `editBlockText`'s job.
 *
 * Exhaustive over all twelve types, not just the seven `create.ts` can build
 * today, so a renderer added for the other five (`docs/design/document-editing.md`)
 * finds this already able to store what it creates.
 */
export function toStoredBlock(block: Block): StoredBlock {
  switch (block.type) {
    case "text":
    case "quote":
    case "code":
      return { id: block.id, type: block.type, content: { text: new Text() } };

    case "heading":
      return {
        id: block.id,
        type: "heading",
        content: { level: block.level, text: new Text() },
      };

    case "list":
      return {
        id: block.id,
        type: "list",
        content: { style: block.style, depth: block.depth, text: new Text() },
      };

    case "checklist":
      return {
        id: block.id,
        type: "checklist",
        content: { checked: block.checked, text: new Text() },
      };

    case "divider":
      return { id: block.id, type: "divider" };

    case "file":
      return {
        id: block.id,
        type: "file",
        content: {
          fileId: block.fileId,
          fileName: block.fileName,
          fileType: block.fileType,
          size: block.size,
        },
      };

    case "image":
    case "pdf":
      return {
        id: block.id,
        type: block.type,
        content: { fileId: block.fileId, fileName: block.fileName, size: block.size },
      };

    case "doc-link":
      return { id: block.id, type: "doc-link", content: { documentId: block.documentId } };

    case "block-link":
      return {
        id: block.id,
        type: "block-link",
        content: { documentId: block.documentId, blockId: block.blockId },
      };
  }
}
