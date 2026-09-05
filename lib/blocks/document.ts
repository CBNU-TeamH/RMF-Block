import { Text } from "@yorkie-js/sdk";

import type {
  Block,
  BlockType,
  HeadingLevel,
  ListStyle,
} from "./types.ts";

/** The bridge between what Yorkie holds and what the app reads. `types.ts`
 *  promises a heading has a `level`; storage cannot, and this is where the
 *  difference is dealt with rather than assumed away. */

/** A block as it actually sits in the document. **Every field beyond `id` and
 *  `type` is optional** — a losing conversion leaves its fields behind, and the
 *  LAN validates nothing. Why the litter stays: `docs/design/document-editing.md`. */
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

/** What a heading that lost its `level` to a race renders as — the same as a
 *  bare "make this a heading". */
const FALLBACK_HEADING_LEVEL: HeadingLevel = 1;

/** Same reasoning: an unordered list is the plainer of the two. */
const FALLBACK_LIST_STYLE: ListStyle = "unordered";

const textOf = (content: StoredContent | undefined): string =>
  content?.text?.toString() ?? "";

/** The strict shape the UI reads — the only place a missing field is decided
 *  about. Falls back rather than throwing: a racing conversion should cost a
 *  heading its level, not cost the reader the document. An unknown `type` is
 *  dropped from the read, not from the document. */
export function readBlocks(blocks: Array<StoredBlock | null>): Array<Block> {
  const result: Array<Block> = [];

  for (const stored of blocks) {
    const block = readBlock(stored);
    if (block) result.push(block);
  }

  return result;
}

/** `null` is dropped like any other malformed entry. `JSONArray` accepts it as
 *  an element and the LAN can write one (`docs/design/api.md` §2); destructuring
 *  first threw before the per-block resilience ever applied. */
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

    // `file`, `image` and the two link types have no creator yet — only `pdf`
    // does (`lib/blocks/create.ts`) — so any of the other four that turn up
    // came from elsewhere. Read anyway rather than dropped: a document that
    // renders half its blocks is worse than one that renders a file block
    // with a blank name.
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
      // Two failures share this branch and only one may be silent: a type from
      // the LAN that is not in the union at all (drop it), versus one that *is*
      // and has no `case` (a bug). `never` holds only while every member is
      // handled, so the second stops compiling while the first still runs.
      const unhandled: never = stored.type;
      void unhandled;

      return null;
    }
  }
}

/** The reverse of `readBlock`. Text becomes a live, empty `yorkie.Text`, never
 *  the plain string a `Block` carries — this only creates the CRDT, and filling
 *  it is `editBlockText`'s job. Exhaustive over all twelve types, not the seven
 *  `create.ts` builds today, so a renderer for the other five finds this ready. */
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
