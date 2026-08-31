import type { HeadingLevel, ListStyle } from "./types.ts";

/**
 * Markdown-style shortcuts that convert a block's type as you type.
 *
 * Divider is not here: it holds no text at all (`document-editing.md`'s "no
 * `content` at all"), so converting to it is not "clear the marker and change
 * `type`" like every other shortcut below — it needs its own operation and
 * its own no-textarea render path, not a regex.
 */

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

/**
 * `text` must be the block's **entire** current content, not merely start
 * with the marker — "# " triggers, "# hello" does not (the marker plus
 * anything else means the marker was typed as a prefix in front of existing
 * content, not as a fresh conversion), and neither does typing "# " in the
 * middle of already-formed text. This is what lets a plain regex be the
 * whole check: the shortcut can only ever match once, right as the marker
 * itself is finished, before there is anything else in the block to
 * misinterpret.
 *
 * Code is the one exception to "marker plus a trailing space": three
 * backticks convert immediately, matching the fence syntax itself rather than
 * a prefix someone would ever type in front of real content.
 */
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
