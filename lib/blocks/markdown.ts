import { documentLinkUrl } from "../chat/links.ts";
import { orderedListNumbers } from "./list-numbering.ts";
import { cellKey } from "./table.ts";
import type { Block, TableBlock } from "./types.ts";

/** Four spaces per level: a nested item under both `- ` and `10. ` in CommonMark. */
const INDENT = "    ";

/** Where an export points a file or a document link instead of this
 *  workspace's address: `docs/design/document-export.md`. */
export type MarkdownLinks = {
  /** The file's path in the export, or `null` when its bytes are gone. */
  file: (fileId: string) => string | null;
  /** The document's path in the export and its name, or `null` when it is not in it. */
  document: (documentId: string) => { path: string; name: string } | null;
};

/** Blocks as Markdown, one block per line: `docs/design/document-editing.md`,
 *  "Selecting and copying blocks". `only` picks the blocks written; list numbers
 *  still count from the whole of `blocks`, so item 3 is copied as `3.`. */
export function blocksToMarkdown(blocks: Array<Block>, origin: string, only?: Set<Block["id"]>): string {
  return writeBlocks(blocks, origin, { only }).map(({ text }) => text).join("\n");
}

/** A whole document as a `.md` file. Blocks are a blank line apart, so a reader
 *  keeps each its own paragraph — the import drops those lines again — except
 *  between list items, which a blank line would space out. */
export function documentToMarkdown(blocks: Array<Block>, origin: string, links: MarkdownLinks): string {
  const written = writeBlocks(blocks, origin, { links });
  const listLike = (type: Block["type"]) => type === "list" || type === "checklist";
  return written
    .map(({ type, text }, index) => (index > 0 && !(listLike(type) && listLike(written[index - 1]!.type)) ? `\n${text}` : text))
    .join("\n");
}

/** A link destination in `<>`, so spaces and brackets in a name need no
 *  escaping; an export's names never hold `<` or `>`. A reader still takes `%`
 *  as an escape, `#` as a fragment and `&` as the start of an entity, so those
 *  three are encoded — only those, so a Korean name stays readable. The label
 *  escapes `[` and `]`. */
const link = (label: string, path: string) =>
  `[${label.replace(/[[\]]/g, "\\$&")}](<${path.replaceAll("%", "%25").replaceAll("#", "%23").replaceAll("&", "%26")}>)`;

function writeBlocks(
  blocks: Array<Block>,
  origin: string,
  { only, links }: { only?: Set<Block["id"]>; links?: MarkdownLinks } = {},
): Array<{ type: Block["type"]; text: string }> {
  const numbers = orderedListNumbers(blocks);
  const written: Array<{ type: Block["type"]; text: string }> = [];
  // The level a list item is written at: a selection that starts inside a nested
  // list still opens at the left margin, and no item is more than one level
  // deeper than the one above it, or Markdown reads it as a code block.
  let runMin = Infinity;
  let previousLevel = -1;

  blocks.forEach((block, index) => {
    if (only && !only.has(block.id)) return;
    const push = (text: string) => written.push({ type: block.type, text });
    if (block.type !== "list") {
      runMin = Infinity;
      previousLevel = -1;
    }

    switch (block.type) {
      case "text":
        push(block.text);
        return;
      case "heading":
        push(`${"#".repeat(block.level)} ${block.text}`);
        return;
      case "list": {
        runMin = Math.min(runMin, block.depth);
        const level = Math.max(0, Math.min(block.depth - runMin, previousLevel + 1));
        previousLevel = level;
        const marker = block.style === "ordered" ? `${numbers[index]}. ` : "- ";
        const indent = INDENT.repeat(level);
        push(`${indent}${marker}${block.text.replaceAll("\n", `\n${indent}${" ".repeat(marker.length)}`)}`);
        return;
      }
      case "checklist":
        push(`- [${block.checked ? "x" : " "}] ${block.text}`);
        return;
      case "quote":
        push(`> ${block.text.replaceAll("\n", "\n> ")}`);
        return;
      case "code": {
        const longestRun = Math.max(0, ...(block.text.match(/`+/g) ?? []).map((run) => run.length));
        const fence = "`".repeat(Math.max(3, longestRun + 1));
        push(`${fence}\n${block.text}\n${fence}`);
        return;
      }
      case "divider":
        push("---");
        return;
      case "table":
        push(tableToMarkdown(block));
        return;
      case "image":
      case "pdf":
      case "file": {
        const bang = block.type === "image" ? "!" : "";
        if (links) {
          const path = links.file(block.fileId);
          push(path ? `${bang}${link(block.fileName, path)}` : block.fileName);
        } else {
          push(`${bang}[${block.fileName}](${origin}/api/files/${block.fileId}/${bang ? "preview" : "download"})`);
        }
        return;
      }
      case "doc-link":
      case "block-link": {
        // A block link to an exported document points at its file: a `.md` has
        // no address for one block in it.
        const target = links?.document(block.documentId);
        push(
          target
            ? link(target.name, target.path)
            : documentLinkUrl(origin, block.documentId, block.type === "block-link" ? block.blockId : undefined),
        );
        return;
      }
    }
  });

  return written;
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
