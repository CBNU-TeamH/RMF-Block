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
 * New blocks of the eight types this project can currently create.
 *
 * The other four — file, image and the two link blocks — have no factory
 * because there is nothing to build one from: they need a `fileId` from an
 * upload this build refuses (only PDFs are accepted, see
 * `app/api/documents/[id]/files/route.ts`) or a `documentId` from a document
 * tree that does not exist (UC-021/023). They stay typed in `types.ts` so a
 * renderer must still handle them.
 *
 * **No factory takes initial text.** That is not an omission to fill in later.
 * A block's text is a `yorkie.Text`, and the only correct way to put characters
 * in one is `edit()` — so the caller creates the block, then edits it. Letting a
 * factory take a string would invite the caller to think of text as a value they
 * can hand over whole, which is the habit that costs the character-level merge
 * (see the note at the top of `types.ts`). Splitting a block on Enter is the
 * case that will want this most, and it wants it as an edit too.
 */

/**
 * `crypto.randomUUID()` is not available here, and the reason is specific to
 * this project: it is a secure-context API, and guests reach the workspace over
 * plain HTTP at `http://<LAN-IP>:3000`. Only the host, on `localhost`, would get
 * a working `randomUUID` — every guest would find it `undefined` and every block
 * they created would fail. `getRandomValues` carries no such gate.
 *
 * The layout is RFC 4122 version 4: sixteen random bytes, with the version in
 * the high nibble of byte 6 and the variant in the top bits of byte 8.
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

/**
 * `level` is required rather than defaulted. It is the one thing the person
 * chose — they picked "제목 2", not "a heading" — so every caller already knows
 * it, and a default would only ever be wrong silently.
 */
export function createHeading(level: HeadingLevel): HeadingBlock {
  return { id: newBlockId(), type: "heading", level, text: "" };
}

/**
 * `style` is required for the same reason as a heading's level: ordered and
 * unordered are two different things to pick, not one thing with a default.
 *
 * `depth` is defaulted because it is not a choice at all — a list item starts at
 * the top level unless something already knows better. What knows better is the
 * editor: pressing Enter inside a nested item should continue at that item's
 * depth, and that is the caller's business, not this function's.
 */
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

/**
 * The first factory that takes arguments beyond a style choice, and every one
 * of them comes from an upload that already happened: `POST
 * /api/documents/:id/files` returns the id, and the name and size are echoed
 * back with it. Nothing here validates them, because there is nowhere better to
 * check — a `fileId` is only meaningful to the server, which is where it came
 * from.
 *
 * The name and size are *cached* into the block on purpose rather than looked
 * up per render: the block has to draw immediately on every other client
 * (NFR-PER-002), and files have no rename in the SRS, so the copy cannot go
 * stale (`docs/design/document-editing.md` §8~10).
 */
export function createPdf(file: {
  fileId: string;
  fileName: string;
  size: number;
}): PdfBlock {
  return { id: newBlockId(), type: "pdf", ...file };
}
