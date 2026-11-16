import { Fragment } from "react";

import { parseInline, type InlineMark, type InlineSegment } from "@/lib/blocks/inline-markdown";

/** A block's text with its inline Markdown drawn (`docs/design/document-editing.md`,
 *  "Inline formatting"). Read-only: links are shown, not followed. */
export function InlineText({ text }: { text: string }) {
  return parseInline(text).map((segment, index) => <Fragment key={index}>{draw(segment)}</Fragment>);
}

function draw({ text, marks, href }: InlineSegment): React.ReactNode {
  const node = marks.reduce<React.ReactNode>((inner, mark) => wrap(mark, inner), text);
  return href === undefined ? node : <span className="text-sky-deep underline">{node}</span>;
}

function wrap(mark: InlineMark, node: React.ReactNode): React.ReactNode {
  switch (mark) {
    case "bold":
      return <strong>{node}</strong>;
    case "italic":
      return <em>{node}</em>;
    case "underline":
      return <u>{node}</u>;
    case "strike":
      return <s>{node}</s>;
    case "code":
      return <code className="rounded bg-code px-1 font-mono text-[0.9em] text-code-ink">{node}</code>;
  }
}
