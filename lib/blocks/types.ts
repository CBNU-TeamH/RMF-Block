/**
 * The twelve block types from `docs/SRS-ko.md` §4.1, as the app reads them.
 *
 * **This is a view model, not the storage shape.** What Yorkie holds is
 * described in `docs/design/document-editing.md`: `root.blocks` is a Yorkie
 * Array, and a block's text is a `yorkie.Text` — a CRDT, not a string. These
 * types are what that becomes once it has been read for rendering.
 *
 * The split matters in one direction only. Reading is a plain conversion and
 * costs nothing worth counting. **Writing must never go back through these
 * types.** Assigning a whole new string over a `yorkie.Text` would throw away
 * the character-level merge that makes two people editing one block work at
 * all — the later write would simply erase the earlier one. Edits go through
 * Yorkie's own API, which is why the operations that perform them live apart
 * from this file rather than taking a `Block` and putting it back.
 */

/** A uuid, stable for the block's whole life and independent of its position. */
export type BlockId = string;

/**
 * SRS §4.1 defines the 제목 블록 as H1~H3, so three is the whole range rather
 * than a starting point. Named because it is the one place to change if the
 * team ever agrees to widen it — which would be an SRS amendment first
 * (`AGENTS.md` §5), not a code change.
 */
export type HeadingLevel = 1 | 2 | 3;

export type ListStyle = "ordered" | "unordered";

/**
 * Every block carries these. `type` is what narrows the union, so a block is
 * never read for a field its kind does not have.
 */
type BlockBase = {
  id: BlockId;
};

/**
 * Text-bearing blocks expose `text` directly rather than the `content` wrapper
 * the stored schema uses.
 *
 * In storage that wrapper is not one shape: for text, quote and code the
 * `content` *is* the `yorkie.Text`, while heading, list and checklist nest it
 * beside their own fields. Mirroring that here would make `block.content` a
 * string in three cases and an object in three others, and every renderer would
 * branch on the type just to reach the words. Flattening gives all six the same
 * `text`, and the six storage shapes are noted per type below so the conversion
 * stays checkable.
 */

/** Storage: `content` is the `yorkie.Text` itself. */
export type TextBlock = BlockBase & {
  type: "text";
  text: string;
};

/** Storage: `content = { level, text }` — `level` is a plain LWW primitive. */
export type HeadingBlock = BlockBase & {
  type: "heading";
  level: HeadingLevel;
  text: string;
};

/**
 * One list *item* is one block, not one block per list. That keeps occupancy
 * (FR-022-06), move and delete working the same way they do everywhere else.
 * Consecutive blocks of the same `style` render as one visual list, and an
 * ordered list's numbers are computed at render time from position — never
 * stored, or every insert would renumber everything after it.
 *
 * Storage: `content = { style, depth, text }`.
 */
export type ListBlock = BlockBase & {
  type: "list";
  style: ListStyle;
  /** Nesting level, 0-based. SRS §4.1 목록 블록 calls for indented sub-lists. */
  depth: number;
  text: string;
};

/**
 * One task per block, same reasoning as the list block. No `depth`: SRS §4.1
 * 체크리스트 블록 does not ask for nesting the way the list block does.
 *
 * Storage: `content = { checked, text }`.
 */
export type ChecklistBlock = BlockBase & {
  type: "checklist";
  checked: boolean;
  text: string;
};

/** Storage: `content` is the `yorkie.Text` itself. Styling comes from `type`. */
export type QuoteBlock = BlockBase & {
  type: "quote";
  text: string;
};

/**
 * No `language` field: SRS asks for "소스코드 또는 고정 폭 텍스트", not
 * syntax highlighting. Fixed-width is a render concern.
 *
 * Storage: `content` is the `yorkie.Text` itself.
 */
export type CodeBlock = BlockBase & {
  type: "code";
  text: string;
};

/** The only type with no content at all — a divider has no data to hold. */
export type DividerBlock = BlockBase & {
  type: "divider";
};

/**
 * The four file-backed and link blocks below cannot be created yet: the File
 * API (FR-022-13/14) and the document tree (UC-021/023) are the things that
 * would hand them a `fileId` or a `documentId`, and neither exists. They are
 * typed anyway so a renderer that meets one is forced to handle it, and so the
 * union matches the finalized schema rather than a subset of it.
 */

/**
 * File bytes never enter the Yorkie document — only a reference plus the
 * metadata needed to render the block immediately, cached at upload time so
 * other clients need no File API round-trip (NFR-PER-002). Files have no rename
 * in the SRS, so the cache cannot go stale.
 *
 * `fileType` is free-form: FR-022-13 allows uploading any file, while
 * FR-022-14 only singles out image/PDF/Word/PPT/Excel for special handling. A
 * closed enum would leave anything else unrepresentable.
 *
 * Storage: `content = { fileId, fileName, fileType, size }`.
 */
export type FileBlock = BlockBase & {
  type: "file";
  fileId: string;
  fileName: string;
  fileType: string;
  /** Bytes. */
  size: number;
};

/**
 * Same pattern as the file block, minus `fileType` — the block `type` already
 * says it. No width, height, alt text or caption: the SRS asks for none.
 *
 * Storage: `content = { fileId, fileName, size }`.
 */
export type ImageBlock = BlockBase & {
  type: "image";
  fileId: string;
  fileName: string;
  size: number;
};

/** Identical shape to the image block. Storage: `content = { fileId, fileName, size }`. */
export type PdfBlock = BlockBase & {
  type: "pdf";
  fileId: string;
  fileName: string;
  size: number;
};

/**
 * No cached title, unlike the file blocks: documents can be renamed and moved
 * (UC-023), so a cached one would go stale — and every client already keeps the
 * document list loaded, so resolving the id costs nothing.
 *
 * Storage: `content = { documentId }`.
 */
export type DocLinkBlock = BlockBase & {
  type: "doc-link";
  documentId: string;
};

/**
 * The 문서 ID + 블록 위치 pair the SRS uses wherever a block is referenced
 * (UC-050, UC-060, UC-070). `blockId` is the target's stable id, never its array
 * position. No cached preview of the target: block content changes more often
 * than anything else here, so that cache would go stale fastest of all.
 *
 * Storage: `content = { documentId, blockId }`.
 */
export type BlockLinkBlock = BlockBase & {
  type: "block-link";
  documentId: string;
  blockId: BlockId;
};

export type Block =
  | TextBlock
  | HeadingBlock
  | ListBlock
  | ChecklistBlock
  | QuoteBlock
  | CodeBlock
  | DividerBlock
  | FileBlock
  | ImageBlock
  | PdfBlock
  | DocLinkBlock
  | BlockLinkBlock;

/** Derived from the union, so a new block type cannot be added without landing here too. */
export type BlockType = Block["type"];
