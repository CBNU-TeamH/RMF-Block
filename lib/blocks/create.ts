import { listDepth } from "./document.ts";
import type {
  BlockId,
  ChecklistBlock,
  CodeBlock,
  DividerBlock,
  HeadingBlock,
  HeadingLevel,
  ListBlock,
  ListStyle,
  DocLinkBlock,
  FileBlock,
  ImageBlock,
  PdfBlock,
  QuoteBlock,
  TextBlock,
} from "./types.ts";

/** New blocks of the eight types this project can create today. **No factory
 *  takes initial text** — a block's text is a `yorkie.Text` whose only correct
 *  write is `edit()`, and a factory taking a string would invite treating text
 *  as a value handed over whole, which costs the character-level merge. */

/** **Not `crypto.randomUUID()`** — a secure-context API, and guests reach this
 *  app over plain HTTP at `http://<LAN-IP>:3000` where it is `undefined`.
 *  `getRandomValues` has no such gate. RFC 4122 v4 layout. */
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
  return { id: newBlockId(), type: "list", style, depth: listDepth(depth), text: "" };
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

/** The image leg of FR-022-14. Same arguments as `createPdf` — which block an
 *  upload becomes is the route's answer, from the bytes, not this file's. */
export function createImage(file: {
  fileId: string;
  fileName: string;
  size: number;
}): ImageBlock {
  return { id: newBlockId(), type: "image", ...file };
}

/** SRS §4.1 type 11. Only the id is stored: the target's name is the catalogue's
 *  to answer and changes under FR-023-01, so caching it here would go stale the
 *  first time anyone renames — unlike a file block's name, which cannot. */
export function createDocLink(documentId: string): DocLinkBlock {
  return { id: newBlockId(), type: "doc-link", documentId };
}

/** FR-022-13, and the fallback for every type FR-022-14 does not name a viewer
 *  for. `fileType` is carried where the other two do not need it: a download
 *  card is all a reader gets, so the type is the only hint at what they will
 *  open. */
export function createFile(file: {
  fileId: string;
  fileName: string;
  fileType: string;
  size: number;
}): FileBlock {
  return { id: newBlockId(), type: "file", ...file };
}
