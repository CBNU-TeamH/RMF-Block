import type { Block } from "../blocks/types.ts";
import type { ChatLink, ChatMessage } from "./types.ts";

/** Chat links (FR-060-01/03/06, FR-061-01): the URLs in a message's text, the
 *  address 링크 복사 copies, and the 링크 tab's list. Why they are shaped this
 *  way: `docs/design/chat.md`, "Links". */

/** Only these become links: a `javascript:` or `data:` URL in a message stays text. */
const URL_PATTERN = /https?:\/\/[^\s<>"]+/g;

/** How much of a block a link keeps to show — a line, not the block. */
export const EXCERPT_MAX = 80;

export type TextPart = { text: string } | { url: string };

const count = (text: string, char: string) => text.split(char).length - 1;

/** Sentence punctuation after a URL belongs to the sentence; a `)` closes the
 *  URL's own `(` (Wikipedia's titles have them) before it closes the sentence's. */
function trimUrl(raw: string): string {
  let url = raw;
  for (;;) {
    const last = url.at(-1) ?? "";
    if (".,;:!?'\"]".includes(last)) url = url.slice(0, -1);
    else if (last === ")" && count(url, ")") > count(url, "(")) url = url.slice(0, -1);
    else return url;
  }
}

/** `text` cut into plain runs and `http(s)` URLs, in order. */
export function splitUrls(text: string): Array<TextPart> {
  const parts: Array<TextPart> = [];
  let from = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const url = trimUrl(match[0]);
    if (match.index > from) parts.push({ text: text.slice(from, match.index) });
    parts.push({ url });
    from = match.index + url.length;
  }
  if (from < text.length) parts.push({ text: text.slice(from) });
  return parts;
}

/** The address 링크 복사 copies: the document, plus `#block=` for one block in it. */
export function documentLinkUrl(origin: string, documentId: string, blockId?: string): string {
  return `${origin}/documents/${encodeURIComponent(documentId)}${blockId ? `#block=${encodeURIComponent(blockId)}` : ""}`;
}

/** The block a `#block=` address points at, or `null`. */
export function blockFromHash(hash: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, "")).get("block") || null;
}

/** What `text` points at when it is one document or block address, or `null`.
 *  From any host: the host's `localhost` and a guest's LAN address are the same
 *  workspace. Whether the document exists is the caller's to check. */
export function parseDocumentLink(text: string): { documentId: string; blockId?: string } | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  const match = /^\/documents\/([^/]+)\/?$/.exec(url.pathname);
  if ((url.protocol !== "http:" && url.protocol !== "https:") || !match) return null;

  const blockId = blockFromHash(url.hash);
  return { documentId: decodeURIComponent(match[1]), ...(blockId ? { blockId } : {}) };
}

/** What a link to `block` shows of it: its text's first line, or its file's
 *  name. `undefined` for a block with neither (a divider, a table). */
export function excerptOf(block: Block): string | undefined {
  const raw = "text" in block ? block.text : "fileName" in block ? block.fileName : "";
  const line = raw.split("\n").find((part) => part.trim())?.trim() ?? "";
  if (!line) return undefined;
  return line.length > EXCERPT_MAX ? `${line.slice(0, EXCERPT_MAX - 1)}…` : line;
}

/** A link on one line: `name`, then the block it points at. */
export function linkLabel(name: string, link: Pick<ChatLink, "blockId" | "excerpt">): string {
  return link.blockId ? `${name} › ${link.excerpt ?? "블록"}` : name;
}

export type SharedLink ={ messageId: string; sender: string; sentAt: string } & (
  | { link: ChatLink }
  | { url: string }
);

/** UC-061's 링크 tab: every document or block link and every URL in the
 *  history, newest first. */
export function sharedLinks(messages: Array<ChatMessage>): Array<SharedLink> {
  const links: Array<SharedLink> = [];
  for (const { id, sender, sentAt, text, link } of messages) {
    const from = { messageId: id, sender, sentAt };
    if (link) links.push({ ...from, link });
    for (const part of splitUrls(text)) {
      if ("url" in part) links.push({ ...from, url: part.url });
    }
  }
  return links.sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}
