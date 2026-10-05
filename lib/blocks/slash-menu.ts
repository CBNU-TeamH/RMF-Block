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
  | { kind: "upload-file" }
  /** Ask which document to link to; the block follows once one is picked. */
  | { kind: "link-document" }
  /** Make a new document inside this one, link to it, and go there. */
  | { kind: "new-page" };

export type SlashItem = {
  /** Stable across renders and locales — used as a React key and in tests. */
  id: string;
  label: string;
  /** The label in English. Ranked with it: `/p` means 페이지 first, and only
   *  then the items `p` happens to start a keyword of (pdf, paragraph). */
  name: string;
  hint: string;
  /** What else matches, ranked below the label and name. Both scripts on
   *  purpose — a person reaching for a heading types `제목` or `h1` depending on
   *  the layout they are in. */
  keywords: Array<string>;
  action: SlashAction;
};

/** Every item, in the order a document is usually built rather than alphabetical. */
export const SLASH_ITEMS: Array<SlashItem> = [
  {
    id: "text",
    label: "텍스트",
    name: "text",
    hint: "일반 문단",
    keywords: ["paragraph", "본문", "문단", "ㅌㅅㅌ"],
    action: { kind: "convert", fields: { type: "text" } },
  },
  {
    id: "heading-1",
    label: "제목 1",
    name: "heading",
    hint: "가장 큰 제목",
    keywords: ["h1", "title"],
    action: { kind: "convert", fields: { type: "heading", level: 1 } },
  },
  {
    id: "heading-2",
    label: "제목 2",
    name: "heading",
    hint: "중간 제목",
    keywords: ["h2"],
    action: { kind: "convert", fields: { type: "heading", level: 2 } },
  },
  {
    id: "heading-3",
    label: "제목 3",
    name: "heading",
    hint: "작은 제목",
    keywords: ["h3"],
    action: { kind: "convert", fields: { type: "heading", level: 3 } },
  },
  {
    id: "list-unordered",
    label: "글머리 목록",
    name: "list",
    hint: "• 로 시작하는 목록",
    keywords: ["bullet", "ul"],
    action: { kind: "convert", fields: { type: "list", style: "unordered" } },
  },
  {
    id: "list-ordered",
    label: "번호 목록",
    name: "list",
    hint: "1. 로 시작하는 목록",
    keywords: ["number", "ordered", "ol"],
    action: { kind: "convert", fields: { type: "list", style: "ordered" } },
  },
  {
    id: "checklist",
    label: "체크리스트",
    name: "checklist",
    hint: "완료 여부를 표시하는 목록",
    keywords: ["todo", "task", "할일"],
    action: { kind: "convert", fields: { type: "checklist" } },
  },
  {
    id: "quote",
    label: "인용",
    name: "quote",
    hint: "인용문",
    keywords: ["blockquote"],
    action: { kind: "convert", fields: { type: "quote" } },
  },
  {
    id: "code",
    label: "코드",
    name: "code",
    hint: "고정 폭 텍스트",
    keywords: ["snippet", "소스"],
    action: { kind: "convert", fields: { type: "code" } },
  },
  {
    id: "divider",
    label: "구분선",
    name: "divider",
    hint: "영역을 나누는 가로선",
    keywords: ["hr", "line", "separator", "선"],
    action: { kind: "divider" },
  },
  {
    id: "file",
    label: "파일",
    name: "file",
    // One item, not three: which block an upload becomes is decided from its
    // bytes (`docs/design/api.md` §1), so asking the person to pick first would
    // be asking them to guess at an answer the server already knows.
    hint: "파일을 올려 문서에 넣기 (이미지·PDF·그 밖의 파일)",
    keywords: ["upload", "image", "pdf", "photo", "첨부", "이미지", "사진", "그림"],
    action: { kind: "upload-file" },
  },
  {
    id: "page",
    label: "페이지",
    name: "page",
    hint: "이 문서 안에 새 페이지를 만들고 그리로 이동",
    keywords: ["new", "sub", "child", "새", "하위", "문서"],
    action: { kind: "new-page" },
  },
  {
    id: "doc-link",
    label: "문서 링크",
    name: "link",
    hint: "워크스페이스의 다른 문서로 가는 링크",
    keywords: ["doc", "document", "연결"],
    action: { kind: "link-document" },
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

/** A lone consonant as an IME shows it (`ㅈ`), in the order of the leading
 *  consonants it stands for (U+1100…). */
const CONSONANTS = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";

/** Each final consonant (U+11A8…, in Unicode order) as it splits once a vowel
 *  follows: a final that stays, if any, then the next syllable's initial. */
const FINAL_SPLITS = [
  "ㄱ", "ㄲ", "ㄱㅅ", "ㄴ", "ㄴㅈ", "ㄴㅎ", "ㄷ", "ㄹ", "ㄹㄱ", "ㄹㅁ", "ㄹㅂ", "ㄹㅅ", "ㄹㅌ", "ㄹㅍ",
  "ㄹㅎ", "ㅁ", "ㅂ", "ㅂㅅ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];

const initial = (c: string) => String.fromCharCode(0x1100 + CONSONANTS.indexOf(c));

/** Hangul as jamo, so `제` is a prefix of `제목` *and* `제모` is — syllables
 *  alone would not say so. */
function jamo(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[ㄱ-ㅎ]/g, (c) => (CONSONANTS.includes(c) ? initial(c) : c));
}

/** The query, plus — when it ends in a final consonant — the reading where
 *  that consonant starts the next syllable instead. An IME shows `젬` on the
 *  way to `제목` and `긂` on the way to `글머리`; it has not decided yet. */
function needles(query: string): Array<string> {
  const needle = jamo(query);
  const split = FINAL_SPLITS[needle.charCodeAt(needle.length - 1) - 0x11a8];
  if (!split) return [needle];

  const head = needle.slice(0, -1);
  const next =
    split.length === 2
      ? String.fromCharCode(0x11a8 + FINAL_SPLITS.indexOf(split[0])) + initial(split[1])
      : initial(split);
  return [needle, head + next];
}

/** Prefix of a label word, the name or a keyword, compared jamo by jamo so the
 *  menu narrows while a syllable is still being composed. Items whose label or
 *  name matches come first and keep menu order; keyword-only matches follow,
 *  so the default highlight is the item the query names. Not fuzzy, whose
 *  ranking is invisible with a dozen items, and not substring, which let
 *  `/eading` find 제목 and read as the menu guessing at a typo (#103). Empty
 *  matches everything, which is what makes a bare `/` show the whole menu.
 *
 *  ponytail: Hangul only, and no 초성 search (`ㅈㅁ` → 제목) — add it here if
 *  the menu grows past what a few letters narrow down. */
export function slashMenuItems(query: string): Array<SlashItem> {
  if (query.trim() === "") return SLASH_ITEMS;
  const candidates = needles(query.trim());

  const matches = (words: Array<string>) =>
    words.some((word) => {
      const letters = jamo(word);
      return candidates.some((needle) => letters.startsWith(needle));
    });

  const named = SLASH_ITEMS.filter((item) => matches([...item.label.split(" "), item.name]));
  const keyworded = SLASH_ITEMS.filter((item) => !named.includes(item) && matches(item.keywords));
  return [...named, ...keyworded];
}

/** Wraps at both ends, the way every menu does. `length` 0 is a no-op. */
export function moveHighlight(current: number, delta: number, length: number): number {
  if (length === 0) return 0;
  return (current + delta + length) % length;
}

/**
 * The `scrollTop` the menu needs for its highlighted row to be visible, or
 * `null` when it already is.
 *
 * Arithmetic rather than `element.scrollIntoView()` on purpose. That walks
 * *every* scroll ancestor, and this editor's scroll container publishes a focus
 * anchor whenever it moves (FR-030-07) — nudging the page to reveal a menu row
 * would send every follower somewhere the presenter never looked. Working the
 * number out here touches the menu and nothing else.
 */
export function scrollTopForHighlight(
  view: { scrollTop: number; height: number },
  row: { top: number; height: number },
): number | null {
  if (row.top < view.scrollTop) return row.top;

  const overshoot = row.top + row.height - (view.scrollTop + view.height);
  if (overshoot <= 0) return null;

  // Never past the row's own top: a row taller than the viewport cannot be shown
  // whole, and cutting off its first line is the worse half to lose.
  const next = Math.min(view.scrollTop + overshoot, row.top);

  return next === view.scrollTop ? null : next;
}
