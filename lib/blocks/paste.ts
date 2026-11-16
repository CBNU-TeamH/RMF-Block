import {
  createChecklist,
  createCode,
  createDivider,
  createHeading,
  createList,
  createQuote,
  createTable,
  createText,
} from "./create.ts";
import { cellKey } from "./table.ts";
import type { Block, HeadingLevel, ListStyle } from "./types.ts";

/** One pasted block: the type it asks for, and its text. A table's text is in its cells. */
export type PastedLine = {
  fields:
    | { type: "text" }
    | { type: "heading"; level: HeadingLevel }
    /** `depth` counts from the pasted text's own left margin. */
    | { type: "list"; style: ListStyle; depth: number }
    | { type: "checklist"; checked: boolean }
    | { type: "quote" }
    | { type: "code" }
    | { type: "divider" }
    /** Rows of cells; the first row is the header. */
    | { type: "table"; cells: Array<Array<string>> };
  text: string;
};

const DIVIDER = /^ {0,3}([-*_])(?: *\1){2,} *$/;
const HEADING = /^ {0,3}(#{1,6})(?: +(.*?))?(?: +#+)? *$/;
const CHECKLIST = /^\s*(?:[-*+] +)?\[([ xX]?)\] (.*)$/;
const LIST = /^(\s*)([-*+]|\d{1,9}[.)])(?: +(.*))?$/;
const QUOTE = /^ {0,3}> ?(.*)$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const TABLE_DELIMITER = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

/** Splits pasted text into the blocks it should become — **never zero**, since a
 *  caller replacing a block needs something to put there. The rules:
 *  `docs/design/document-editing.md`, "Pasting more than one line". */
export function parsePaste(text: string): Array<PastedLine> {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");

  // One trailing newline only — blank lines between lines are the person's own
  // spacing (`document-editing.md`, "Pasting more than one line").
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();

  const blocks: Array<PastedLine> = [];
  // The indentation of each open list level, outermost first.
  const listIndents: Array<number> = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const fence = FENCE.exec(line);
    const delimiter = lines[i + 1] ?? "";
    let block: PastedLine;

    if (fence) {
      const body: Array<string> = [];
      let j = i + 1;
      while (j < lines.length && !closesFence(lines[j]!, fence[1]!)) body.push(lines[j++]!);
      block = { fields: { type: "code" }, text: body.join("\n") };
      i = j;
    } else if (line.includes("|") && delimiter.includes("|") && TABLE_DELIMITER.test(delimiter)) {
      const header = cellsOf(line);
      const rows = [header];
      let j = i + 2;
      while (j < lines.length && lines[j]!.includes("|")) {
        const row = cellsOf(lines[j++]!);
        rows.push(header.map((_, column) => row[column] ?? ""));
      }
      block = { fields: { type: "table", cells: rows }, text: "" };
      i = j - 1;
    } else {
      block = lineToBlock(line, listIndents);
    }

    if (block.fields.type !== "list") listIndents.length = 0;
    blocks.push(block);
  }

  return blocks;
}

function lineToBlock(line: string, listIndents: Array<number>): PastedLine {
  if (DIVIDER.test(line)) return { fields: { type: "divider" }, text: "" };

  const heading = HEADING.exec(line);
  if (heading) {
    const level = Math.min(heading[1]!.length, 3) as HeadingLevel;
    return { fields: { type: "heading", level }, text: heading[2] ?? "" };
  }

  const checklist = CHECKLIST.exec(line);
  if (checklist) return { fields: { type: "checklist", checked: checklist[1]!.toLowerCase() === "x" }, text: checklist[2]! };

  const list = LIST.exec(line);
  if (list && list[3] !== undefined) {
    const style: ListStyle = /\d/.test(list[2]!) ? "ordered" : "unordered";
    return { fields: { type: "list", style, depth: depthOf(indentOf(list[1]!), listIndents) }, text: list[3] };
  }

  const quote = QUOTE.exec(line);
  if (quote) return { fields: { type: "quote" }, text: quote[1]! };

  return { fields: { type: "text" }, text: line };
}

/** Nesting from indentation: deeper than the level above opens a level, and
 *  going back out closes every level indented further than this line. */
function depthOf(indent: number, listIndents: Array<number>): number {
  while (listIndents.length > 0 && listIndents[listIndents.length - 1]! > indent) listIndents.pop();
  if (listIndents.length === 0 || indent > listIndents[listIndents.length - 1]!) listIndents.push(indent);
  return listIndents.length - 1;
}

function indentOf(whitespace: string): number {
  return [...whitespace].reduce((width, char) => width + (char === "\t" ? 4 : 1), 0);
}

function closesFence(line: string, open: string): boolean {
  const close = /^ {0,3}(`{3,}|~{3,}) *$/.exec(line)?.[1];
  return close !== undefined && close[0] === open[0] && close.length >= open.length;
}

/** A GFM row's cells: outer pipes dropped, `\|` kept as a pipe, `<br>` as a line break. */
function cellsOf(row: string): Array<string> {
  const cells: Array<string> = [];
  let cell = "";
  const trimmed = row.trim().replace(/^\|/, "");
  for (let i = 0; i < trimmed.length; i += 1) {
    if (trimmed[i] === "\\" && trimmed[i + 1] === "|") {
      cell += "|";
      i += 1;
    } else if (trimmed[i] === "|") {
      cells.push(cell);
      cell = "";
    } else {
      cell += trimmed[i];
    }
  }
  if (cell.trim() !== "" || !trimmed.endsWith("|")) cells.push(cell);
  return cells.map((text) => text.trim().replace(/<br\s*\/?>/gi, "\n"));
}

/** The block a pasted line becomes, its text included (a table's, in its cells).
 *  `create.ts` is the one place a block of each type is built. */
export function pastedBlock({ fields, text }: PastedLine): Block {
  switch (fields.type) {
    case "heading":
      return { ...createHeading(fields.level), text };
    case "list":
      return { ...createList(fields.style, fields.depth), text };
    case "checklist":
      // `createChecklist` is always unchecked — "a task that is already done
      // is not a task anyone adds" — which holds for a new one and not for a
      // pasted one, where `[x]` is the whole point of writing it.
      return { ...createChecklist(), checked: fields.checked, text };
    case "quote":
      return { ...createQuote(), text };
    case "code":
      return { ...createCode(), text };
    case "divider":
      return createDivider();
    case "table": {
      const table = createTable(fields.cells.length, fields.cells[0]!.length);
      fields.cells.forEach((row, r) =>
        row.forEach((cell, c) => (table.cells[cellKey(table.rows[r]!, table.columns[c]!)] = cell)),
      );
      return table;
    }
    case "text":
      return { ...createText(), text };
  }
}
