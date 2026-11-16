import { documentLinkUrl } from "../chat/links.ts";
import { orderedListNumbers } from "./list-numbering.ts";
import { cellKey } from "./table.ts";
import type { Block, TableBlock } from "./types.ts";

/** Four spaces per level: a nested item under both `- ` and `10. ` in CommonMark. */
const INDENT = "    ";

/** Blocks as Markdown, one block per line: `docs/design/document-editing.md`,
 *  "Selecting and copying blocks". `only` picks the blocks written; list numbers
 *  still count from the whole of `blocks`, so item 3 is copied as `3.`. */
export function blocksToMarkdown(blocks: Array<Block>, origin: string, only?: Set<Block["id"]>): string {
  const numbers = orderedListNumbers(blocks);
  const lines: Array<string> = [];
  // The level a list item is written at: a selection that starts inside a nested
  // list still opens at the left margin, and no item is more than one level
  // deeper than the one above it, or Markdown reads it as a code block.
  let runMin = Infinity;
  let previousLevel = -1;

  blocks.forEach((block, index) => {
    if (only && !only.has(block.id)) return;
    if (block.type !== "list") {
      runMin = Infinity;
      previousLevel = -1;
    }

    switch (block.type) {
      case "text":
        lines.push(block.text);
        return;
      case "heading":
        lines.push(`${"#".repeat(block.level)} ${block.text}`);
        return;
      case "list": {
        runMin = Math.min(runMin, block.depth);
        const level = Math.max(0, Math.min(block.depth - runMin, previousLevel + 1));
        previousLevel = level;
        const marker = block.style === "ordered" ? `${numbers[index]}. ` : "- ";
        const indent = INDENT.repeat(level);
        lines.push(`${indent}${marker}${block.text.replaceAll("\n", `\n${indent}${" ".repeat(marker.length)}`)}`);
        return;
      }
      case "checklist":
        lines.push(`- [${block.checked ? "x" : " "}] ${block.text}`);
        return;
      case "quote":
        lines.push(`> ${block.text.replaceAll("\n", "\n> ")}`);
        return;
      case "code": {
        const longestRun = Math.max(0, ...(block.text.match(/`+/g) ?? []).map((run) => run.length));
        const fence = "`".repeat(Math.max(3, longestRun + 1));
        lines.push(`${fence}\n${block.text}\n${fence}`);
        return;
      }
      case "divider":
        lines.push("---");
        return;
      case "table":
        lines.push(tableToMarkdown(block));
        return;
      case "image":
        lines.push(`![${block.fileName}](${origin}/api/files/${block.fileId}/preview)`);
        return;
      case "pdf":
      case "file":
        lines.push(`[${block.fileName}](${origin}/api/files/${block.fileId}/download)`);
        return;
      case "doc-link":
        lines.push(documentLinkUrl(origin, block.documentId));
        return;
      case "block-link":
        lines.push(documentLinkUrl(origin, block.documentId, block.blockId));
        return;
    }
  });

  return lines.join("\n");
}

/** GFM: the first row is the header, since a table block has no header row of its own. */
function tableToMarkdown(table: TableBlock): string {
  const cell = (rowId: string, columnId: string) =>
    (table.cells[cellKey(rowId, columnId)] ?? "").replaceAll("|", "\\|").replaceAll("\n", "<br>");
  const row = (rowId: string) => `| ${table.columns.map((columnId) => cell(rowId, columnId)).join(" | ")} |`;
  const [header, ...body] = table.rows;
  if (header === undefined) return "";
  return [row(header), `| ${table.columns.map(() => "---").join(" | ")} |`, ...body.map(row)].join("\n");
}
