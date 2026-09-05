/** The twelve block types of `docs/SRS-ko.md` §4.1, as the app *reads* them.
 *  **Read-only.** A block's text is a `yorkie.Text`; assigning a string over one
 *  erases what a peer typed instead of merging, so writes go through
 *  `operations.ts`. Stored shapes: `docs/design/document-editing.md`. */

/** A uuid, stable for the block's whole life and independent of its position. */
export type BlockId = string;

/** H1~H3 is the whole range SRS §4.1 defines, not a starting point — widening
 *  it is an SRS amendment first (`AGENTS.md` §5). */
export type HeadingLevel = 1 | 2 | 3;

export type ListStyle = "ordered" | "unordered";

/** What every block carries; `type` is what narrows the union. */
type BlockBase = {
  id: BlockId;
};

/** The six text-bearing types flatten storage's `content.text` to `text` — the
 *  doc's "Every text-bearing block wraps its text" says why storage keeps it. */
export type TextBlock = BlockBase & {
  type: "text";
  text: string;
};

export type HeadingBlock = BlockBase & {
  type: "heading";
  level: HeadingLevel;
  text: string;
};

/** One list *item* is one block, which is what keeps occupancy (FR-022-06),
 *  move and delete uniform across every type. */
export type ListBlock = BlockBase & {
  type: "list";
  style: ListStyle;
  /** Nesting level, 0-based. SRS §4.1 목록 블록 calls for indented sub-lists. */
  depth: number;
  text: string;
};

/** One task per block. No `depth` — SRS §4.1 체크리스트 블록 asks for no nesting. */
export type ChecklistBlock = BlockBase & {
  type: "checklist";
  checked: boolean;
  text: string;
};

export type QuoteBlock = BlockBase & {
  type: "quote";
  text: string;
};

/** No `language` field: SRS §4.1 asks for 고정 폭 텍스트, not highlighting (#46). */
export type CodeBlock = BlockBase & {
  type: "code";
  text: string;
};

/** The only type with no content at all — a divider has no data to hold. */
export type DividerBlock = BlockBase & {
  type: "divider";
};

/** Of the five below only `pdf` can be created today — `file` and `image` wait
 *  on FR-022-14's other legs, the link types on the document tree. All five stay
 *  typed, so `BLOCK_KINDS` and every renderer must handle them. */

/** A reference plus display metadata cached at upload (NFR-PER-002); the bytes
 *  stay out of Yorkie. `fileType` is free-form on purpose (FR-022-13). */
export type FileBlock = BlockBase & {
  type: "file";
  fileId: string;
  fileName: string;
  fileType: string;
  /** Bytes. */
  size: number;
};

export type ImageBlock = BlockBase & {
  type: "image";
  fileId: string;
  fileName: string;
  size: number;
};

export type PdfBlock = BlockBase & {
  type: "pdf";
  fileId: string;
  fileName: string;
  size: number;
};

/** No cached title — a document can be renamed (UC-023). */
export type DocLinkBlock = BlockBase & {
  type: "doc-link";
  documentId: string;
};

/** The 문서 ID + 블록 위치 pair (UC-050, UC-060, UC-070). `blockId` is the
 *  target's stable id, never its array position. */
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
