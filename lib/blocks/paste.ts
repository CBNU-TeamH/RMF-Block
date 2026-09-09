import { detectMarkdownShortcut } from "./markdown-shortcuts.ts";
import type { HeadingLevel, ListStyle } from "./types.ts";

/** One pasted line: the type it asks for, and the text after the marker. */
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

/** The marker and its space, so the table below can read the marker alone. */
const MARKER = /^(#{1,3} |\[[ x]?\] |[-*] |\d+\. |> )/;

/** Splits pasted text into the blocks it should become — one entry per line,
 *  **never zero**, since a caller replacing a block needs something to put
 *  there. The rules: `docs/design/document-editing.md`, "Pasting more than one
 *  line". */
export function parsePaste(text: string): Array<PastedLine> {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");

  // One trailing newline only — blank lines between lines are the person's own
  // spacing (`document-editing.md`, "Pasting more than one line").
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();

  return lines.map(lineToBlock);
}

function lineToBlock(line: string): PastedLine {
  const marker = MARKER.exec(line);
  if (!marker) return { fields: { type: "text" }, text: line };

  const rest = line.slice(marker[1]!.length);

  // `[x] ` is the one marker only a paste can carry (`document-editing.md`,
  // "Pasting more than one line").
  if (marker[1]!.startsWith("[")) {
    return { fields: { type: "checklist", checked: marker[1]![1] === "x" }, text: rest };
  }

  // Handed over as it would have been typed, so one table decides what a marker
  // means either way. A checklist cannot reach here — every `[`-led marker
  // returned above — but the table's type still admits one with no `checked`,
  // and falling back keeps this total without a cast.
  const shortcut = detectMarkdownShortcut(marker[1]!);
  if (!shortcut || shortcut.type === "checklist") return { fields: { type: "text" }, text: line };

  return { fields: shortcut, text: rest };
}
