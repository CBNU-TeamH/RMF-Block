import type { HeadingLevel } from "./types.ts";

/**
 * Markdown-style shortcuts that convert a block's type as you type. Only the
 * heading marker is built so far — list/checklist/quote/code shortcuts land
 * with those types in milestone 4 (numbering, checkboxes and the rest need
 * more than a regex).
 */

const HEADING_MARKER = /^(#{1,3}) $/;

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
 * Caps at H3 by construction (SRS §4.1 gives headings no more levels), so
 * "#### " simply never matches and is left as plain text.
 */
export function headingShortcut(text: string): HeadingLevel | null {
  const match = HEADING_MARKER.exec(text);
  if (!match) return null;
  return match[1]!.length as HeadingLevel;
}
