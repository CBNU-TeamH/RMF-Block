import type {
  BlockId,
  ChecklistBlock,
  CodeBlock,
  DividerBlock,
  HeadingBlock,
  HeadingLevel,
  ListBlock,
  ListStyle,
  PdfBlock,
  QuoteBlock,
  TextBlock,
} from "./types.ts";

/**
 * New blocks of the eight types this project can create today; the other four
 * have nothing to build one from (see `types.ts`).
 *
 * **No factory takes initial text**, and that is not an omission. A block's
 * text is a `yorkie.Text`, whose only correct write is `edit()` — so a caller
 * creates the block, then edits it. A factory taking a string would invite
 * treating text as a value handed over whole, which is what costs the
 * character-level merge.
 */

/**
 * **Not `crypto.randomUUID()`**: it is a secure-context API and guests reach
 * this app over plain HTTP at `http://<LAN-IP>:3000`, where it is `undefined`.
 * Only the host, on `localhost`, would get one. `getRandomValues` has no gate.
 *
 * RFC 4122 v4 layout: the version in the high nibble of byte 6, the variant in
 * the top bits of byte 8.
 */
export function newBlockId(): BlockId {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

export function createText(): TextBlock {
  return { id: newBlockId(), type: "text", text: "" };
}

/** `level` is required: it is the one thing the person picked, so a default
 *  would only ever be silently wrong. */
export function createHeading(level: HeadingLevel): HeadingBlock {
  return { id: newBlockId(), type: "heading", level, text: "" };
}

/** `style` is required for the same reason a heading's `level` is. `depth` is
 *  not a choice — only the editor knows when a new item continues a nested one. */
export function createList(style: ListStyle, depth = 0): ListBlock {
  return { id: newBlockId(), type: "list", style, depth, text: "" };
}

/** Always unchecked: a task that is already done is not a task anyone adds. */
export function createChecklist(): ChecklistBlock {
  return { id: newBlockId(), type: "checklist", checked: false, text: "" };
}

export function createQuote(): QuoteBlock {
  return { id: newBlockId(), type: "quote", text: "" };
}

export function createCode(): CodeBlock {
  return { id: newBlockId(), type: "code", text: "" };
}

export function createDivider(): DividerBlock {
  return { id: newBlockId(), type: "divider" };
}

/** Every argument comes back from `POST /api/documents/:id/files`, so nothing
 *  here validates them. Name and size are cached into the block deliberately —
 *  see the doc's file-block section. */
export function createPdf(file: {
  fileId: string;
  fileName: string;
  size: number;
}): PdfBlock {
  return { id: newBlockId(), type: "pdf", ...file };
}
