import type { TypeFields } from "./operations.ts";

/**
 * The `/` menu — UC-022's own way in ("사용자 1이 '/'로 파일 블록을 선택하거나").
 *
 * Until this existed, the only way to change a block's type was a markdown
 * marker, and the markers cover six of the twelve types. A divider had no way
 * into a document at all: no marker, no menu, nothing. That is what this fixes
 * as much as the convenience.
 *
 * The list and the matching live here, apart from React, for the reason every
 * other decision in `lib/blocks/` does: they are the part worth testing, and a
 * `<textarea>` is not needed to test them.
 */

/** What picking an item does. The editor owns the doing; this only names it. */
export type SlashAction =
  /** Change this block's type in place, keeping its id and its `yorkie.Text`. */
  | { kind: "convert"; fields: TypeFields }
  /** Put a divider above this block and leave the caret where it is. */
  | { kind: "divider" }
  /** Open the file picker; the block follows once the upload returns an id. */
  | { kind: "upload-pdf" };

export type SlashItem = {
  /** Stable across renders and locales — used as a React key and in tests. */
  id: string;
  label: string;
  hint: string;
  /**
   * What typing matches this item, beyond its label. Both scripts on purpose:
   * someone reaching for a heading types `제목` or `h1` or `heading` depending
   * on which keyboard layout they are in the middle of using.
   */
  keywords: Array<string>;
  action: SlashAction;
};

/**
 * Every item, in menu order — the order a document is usually built in rather
 * than alphabetical: paragraph, headings, the three list kinds, then the two
 * that are not text, then the file.
 */
export const SLASH_ITEMS: Array<SlashItem> = [
  {
    id: "text",
    label: "텍스트",
    hint: "일반 문단",
    keywords: ["text", "paragraph", "본문", "문단", "ㅌㅅㅌ"],
    action: { kind: "convert", fields: { type: "text" } },
  },
  {
    id: "heading-1",
    label: "제목 1",
    hint: "가장 큰 제목",
    keywords: ["h1", "heading", "title", "제목"],
    action: { kind: "convert", fields: { type: "heading", level: 1 } },
  },
  {
    id: "heading-2",
    label: "제목 2",
    hint: "중간 제목",
    keywords: ["h2", "heading", "제목"],
    action: { kind: "convert", fields: { type: "heading", level: 2 } },
  },
  {
    id: "heading-3",
    label: "제목 3",
    hint: "작은 제목",
    keywords: ["h3", "heading", "제목"],
    action: { kind: "convert", fields: { type: "heading", level: 3 } },
  },
  {
    id: "list-unordered",
    label: "글머리 목록",
    hint: "• 로 시작하는 목록",
    keywords: ["list", "bullet", "ul", "목록", "글머리"],
    action: { kind: "convert", fields: { type: "list", style: "unordered" } },
  },
  {
    id: "list-ordered",
    label: "번호 목록",
    hint: "1. 로 시작하는 목록",
    keywords: ["list", "number", "ordered", "ol", "목록", "번호"],
    action: { kind: "convert", fields: { type: "list", style: "ordered" } },
  },
  {
    id: "checklist",
    label: "체크리스트",
    hint: "완료 여부를 표시하는 목록",
    keywords: ["todo", "task", "check", "체크", "할일"],
    action: { kind: "convert", fields: { type: "checklist" } },
  },
  {
    id: "quote",
    label: "인용",
    hint: "인용문",
    keywords: ["quote", "blockquote", "인용"],
    action: { kind: "convert", fields: { type: "quote" } },
  },
  {
    id: "code",
    label: "코드",
    hint: "고정 폭 텍스트",
    keywords: ["code", "snippet", "코드", "소스"],
    action: { kind: "convert", fields: { type: "code" } },
  },
  {
    id: "divider",
    label: "구분선",
    hint: "영역을 나누는 가로선",
    keywords: ["divider", "hr", "line", "separator", "구분", "구분선", "선"],
    action: { kind: "divider" },
  },
  {
    id: "pdf",
    label: "PDF",
    hint: "PDF 파일을 올려 문서에 넣기",
    keywords: ["pdf", "file", "upload", "파일", "첨부"],
    action: { kind: "upload-pdf" },
  },
];

/**
 * The query a block's text is asking the menu, or `null` when it is not asking.
 *
 * The slash has to be the block's **first** character. Mid-text `/` is left
 * alone deliberately: a URL, a date and a fraction all contain one, and this
 * project's existing conversion trigger (`detectMarkdownShortcut`) already
 * matches on the whole of a block's text rather than on a position within it.
 * Same rule, so there is one thing to remember rather than two.
 *
 * A space ends it. `/` followed by a word is a search; `/ ` is someone typing
 * a sentence that happens to start with a slash, and they should be left to it.
 */
export function detectSlashQuery(text: string): string | null {
  if (!text.startsWith("/")) return null;

  const query = text.slice(1);
  if (query.includes(" ") || query.includes("\n")) return null;

  return query;
}

/**
 * The items a query matches, in menu order.
 *
 * Substring, not fuzzy, and case-insensitive: with eleven items the ranking a
 * fuzzy matcher buys is invisible, while its surprises are not. An empty query
 * matches everything, which is what makes a bare `/` show the whole menu.
 */
export function slashMenuItems(query: string): Array<SlashItem> {
  const needle = query.trim().toLowerCase();
  if (needle === "") return SLASH_ITEMS;

  return SLASH_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(needle) ||
      item.keywords.some((keyword) => keyword.toLowerCase().includes(needle)),
  );
}

/** Wraps at both ends, the way every menu does. `length` 0 is a no-op. */
export function moveHighlight(current: number, delta: number, length: number): number {
  if (length === 0) return 0;
  return (current + delta + length) % length;
}
