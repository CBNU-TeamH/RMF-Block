import type { HeadingLevel, ListStyle } from "./types.ts";

/** Markdown-style shortcuts that convert a block's type as you type. Divider is
 *  not here: it holds no text at all, so converting to it needs its own
 *  operation and render path rather than a regex. */

export type MarkdownShortcut =
  | { type: "heading"; level: HeadingLevel }
  | { type: "quote" }
  | { type: "code" }
  | { type: "checklist" }
  | { type: "list"; style: ListStyle };

const HEADING_MARKER = /^(#{1,3}) $/;
const CHECKLIST_MARKER = /^\[ ?\] $/;
const UNORDERED_LIST_MARKER = /^[-*] $/;
const ORDERED_LIST_MARKER = /^\d+\. $/;

/** `text` must be the block's **entire** content — `"# "` triggers, `"# hello"`
 *  does not, which is what lets a plain regex be the whole check. Code is the
 *  exception: three backticks convert at once, matching the fence syntax. */
export function detectMarkdownShortcut(text: string): MarkdownShortcut | null {
  const heading = HEADING_MARKER.exec(text);
  if (heading) return { type: "heading", level: heading[1]!.length as HeadingLevel };

  if (text === "```") return { type: "code" };
  if (text === "> ") return { type: "quote" };
  if (CHECKLIST_MARKER.test(text)) return { type: "checklist" };
  if (UNORDERED_LIST_MARKER.test(text)) return { type: "list", style: "unordered" };
  if (ORDERED_LIST_MARKER.test(text)) return { type: "list", style: "ordered" };

  return null;
}
