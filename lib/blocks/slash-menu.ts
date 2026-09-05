import type { TypeFields } from "./operations.ts";

/** The `/` menu — UC-022's own way in ("사용자 1이 '/'로 파일 블록을 선택하거나").
 *  Markdown markers reach only six of the twelve types and a divider had no way
 *  in at all. Apart from React because this is the part worth testing. */

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
  /** What matches beyond the label. Both scripts on purpose — a person reaching
   *  for a heading types `제목` or `h1` depending on the layout they are in. */
  keywords: Array<string>;
  action: SlashAction;
};

/** Every item, in the order a document is usually built rather than alphabetical. */
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

/** The query a block's text is asking the menu, or `null`. The slash must be the
 *  **first** character — a URL, a date and a fraction all contain one, and
 *  `detectMarkdownShortcut` already matches on whole text rather than position,
 *  so this is the same rule rather than a second one. A space ends it. */
export function detectSlashQuery(text: string): string | null {
  if (!text.startsWith("/")) return null;

  const query = text.slice(1);
  if (query.includes(" ") || query.includes("\n")) return null;

  return query;
}

/** Substring, not fuzzy: with eleven items a fuzzy matcher's ranking is
 *  invisible and its surprises are not. Empty matches everything, which is what
 *  makes a bare `/` show the whole menu. */
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
