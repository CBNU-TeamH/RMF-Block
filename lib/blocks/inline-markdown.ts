/** The inline marks a block's text can carry as typed Markdown: `docs/design/document-editing.md`,
 *  "Inline formatting". Stored text is never rewritten; this only reads it for display. */
export type InlineMark = "bold" | "italic" | "underline" | "strike" | "code";

export type InlineSegment = { text: string; marks: Array<InlineMark>; href?: string };

/** Paired delimiters, longest first so `**` is tried before `*`. */
const PAIRS: Array<{ open: string; close: string; marks: Array<InlineMark> }> = [
  { open: "<u>", close: "</u>", marks: ["underline"] },
  { open: "***", close: "***", marks: ["bold", "italic"] },
  { open: "**", close: "**", marks: ["bold"] },
  { open: "__", close: "__", marks: ["bold"] },
  { open: "~~", close: "~~", marks: ["strike"] },
  { open: "*", close: "*", marks: ["italic"] },
  { open: "_", close: "_", marks: ["italic"] },
];

const ESCAPABLE = new Set("\\`*_{}[]()#+-.!|~<>");
const isWordChar = (char: string | undefined) => char !== undefined && /[\p{L}\p{N}]/u.test(char);

/** Splits `text` into runs that share the same marks. Unclosed delimiters stay as text. */
export function parseInline(text: string): Array<InlineSegment> {
  if (!/[*_~`<[\\]/.test(text)) return text ? [{ text, marks: [] }] : [];
  const segments: Array<InlineSegment> = [];
  read(text, [], undefined, segments);
  return segments;
}

/** Whether `parseInline`'s segments draw differently from plain text. */
export function hasMarks(segments: Array<InlineSegment>): boolean {
  return segments.some((segment) => segment.marks.length > 0 || segment.href !== undefined);
}

/** The keyboard shortcuts' markers: Ctrl/Cmd+B, I and U. */
export const SHORTCUT_MARKERS: Record<"b" | "i" | "u", { open: string; close: string }> = {
  b: { open: "**", close: "**" },
  i: { open: "*", close: "*" },
  u: { open: "<u>", close: "</u>" },
};

/** Wraps `[from, to)` in `open`/`close`, or unwraps it when it is already wrapped.
 *  Returns the new text and the selection that keeps covering the same characters. */
export function toggleMarker(
  text: string,
  from: number,
  to: number,
  { open, close }: { open: string; close: string },
): { text: string; from: number; to: number } {
  if (isWrapped(text, from, to, open, close)) {
    return {
      text: text.slice(0, from - open.length) + text.slice(from, to) + text.slice(to + close.length),
      from: from - open.length,
      to: to - open.length,
    };
  }
  return {
    text: text.slice(0, from) + open + text.slice(from, to) + close + text.slice(to),
    from: from + open.length,
    to: to + open.length,
  };
}

/** Whether `[from, to)` already carries `open`/`close`. `*` is one run shared by italic and bold, so
 *  `**x**` is bold, not italic-to-unwrap: italic needs an odd run, bold two or more. */
function isWrapped(text: string, from: number, to: number, open: string, close: string): boolean {
  if (open[0] !== "*") return text.slice(from - open.length, from) === open && text.slice(to, to + close.length) === close;
  let left = 0;
  while (text[from - 1 - left] === "*") left += 1;
  let right = 0;
  while (text[to + right] === "*") right += 1;
  const run = Math.min(left, right);
  return open === "*" ? run % 2 === 1 : run >= 2;
}

function push(segments: Array<InlineSegment>, text: string, marks: Array<InlineMark>, href: string | undefined) {
  if (text === "") return;
  const last = segments[segments.length - 1];
  if (last && last.href === href && last.marks.join() === marks.join()) last.text += text;
  else segments.push(href === undefined ? { text, marks } : { text, marks, href });
}

function read(text: string, marks: Array<InlineMark>, href: string | undefined, out: Array<InlineSegment>): void {
  let plain = "";
  let i = 0;
  const flush = () => {
    push(out, plain, marks, href);
    plain = "";
  };

  while (i < text.length) {
    const char = text[i]!;

    if (char === "\\" && ESCAPABLE.has(text[i + 1] ?? "")) {
      plain += text[i + 1];
      i += 2;
      continue;
    }

    if (char === "`") {
      const run = /^`+/.exec(text.slice(i))![0];
      const end = text.indexOf(run, i + run.length);
      if (end > i + run.length) {
        flush();
        push(out, text.slice(i + run.length, end), [...marks, "code"], href);
        i = end + run.length;
        continue;
      }
    }

    if (char === "[" && href === undefined) {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(text.slice(i));
      if (link) {
        flush();
        read(link[1]!, marks, link[2], out);
        i += link[0].length;
        continue;
      }
    }

    const pair = PAIRS.find(({ open }) => text.startsWith(open, i));
    const end = pair ? closingOf(text, i, pair.open, pair.close) : -1;
    if (pair && end !== -1) {
      flush();
      const added = pair.marks.filter((mark) => !marks.includes(mark));
      read(text.slice(i + pair.open.length, end), [...marks, ...added], href, out);
      i = end + pair.close.length;
      continue;
    }

    plain += char;
    i += 1;
  }
  flush();
}

/** Where the delimiter opened at `start` closes, or -1 — CommonMark's flanking rules, cut down. */
function closingOf(text: string, start: number, open: string, close: string): number {
  const from = start + open.length;
  if (from >= text.length || /\s/.test(text[from]!)) return -1;
  if (open === "_" || open === "__") {
    if (isWordChar(text[start - 1])) return -1;
  }

  const last = text.lastIndexOf(close);
  for (let j = from + 1; j <= last; j += 1) {
    // A `**` inside `*…*` belongs to a nested bold, not to this italic.
    if (open === "*" && text.startsWith("**", j)) {
      const inner = closingOf(text, j, "**", "**");
      if (inner !== -1) {
        j = inner + 1;
        continue;
      }
    }
    if (!text.startsWith(close, j) || /\s/.test(text[j - 1]!)) continue;
    if ((close === "_" || close === "__") && isWordChar(text[j + close.length])) continue;
    // `**bold *it***`: the bold closes on the last two of the three.
    if (close === "**" && text[j + 2] === "*") return j + 1;
    return j;
  }
  return -1;
}
