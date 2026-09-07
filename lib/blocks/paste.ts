import { detectMarkdownShortcut } from "./markdown-shortcuts.ts";
import type { HeadingLevel, ListStyle } from "./types.ts";

/**
 * One pasted line: the block type it asks for, and the text left after the
 * marker is taken off.
 */
export type PastedLine = {
  fields:
    | { type: "text" }
    | { type: "heading"; level: HeadingLevel }
    | { type: "list"; style: ListStyle }
    | { type: "checklist"; checked: boolean }
    | { type: "quote" }
    | { type: "code" };
  text: string;
};

/** `- item` → the marker and the space, so `detectMarkdownShortcut` can read the
 *  marker on its own and the rest becomes the block's text. */
const MARKER = /^(#{1,3} |\[[ x]?\] |[-*] |\d+\. |> )/;

/**
 * Splits pasted text into the blocks it should become.
 *
 * Returns one entry per line, **never zero** — a caller replacing a block needs
 * something to put there. Why a single line is not a block operation at all,
 * and why the first line reuses the block being pasted into:
 * `docs/design/document-editing.md`, "Pasting more than one line".
 */
export function parsePaste(text: string): Array<PastedLine> {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");

  // A trailing newline is how a copied paragraph ends, not a request for an
  // empty block after it. Only the last one goes: blank lines *between* lines
  // are the person's own spacing.
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();

  return lines.map(lineToBlock);
}

function lineToBlock(line: string): PastedLine {
  const marker = MARKER.exec(line);
  if (!marker) return { fields: { type: "text" }, text: line };

  const rest = line.slice(marker[1]!.length);

  // A checked box is the one marker only a paste can carry. `[x] ` is not
  // something anyone types — you type `[] ` and click — so
  // `detectMarkdownShortcut` does not know it, correctly.
  if (marker[1]!.startsWith("[")) {
    return { fields: { type: "checklist", checked: marker[1]![1] === "x" }, text: rest };
  }

  // Everything else is handed over exactly as it would have been typed, so one
  // table decides what a marker means whether it arrives by keystroke or paste.
  // A checklist shortcut cannot arrive here — every `[`-led marker returned
  // above — but the table's own type still admits one, and it carries no
  // `checked`. Falling back to text keeps this total without a cast.
  const shortcut = detectMarkdownShortcut(marker[1]!);
  if (!shortcut || shortcut.type === "checklist") return { fields: { type: "text" }, text: line };

  return { fields: shortcut, text: rest };
}
