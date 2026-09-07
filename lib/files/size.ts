/**
 * A byte count as a person reads it.
 *
 * Shared rather than restated, which `pdf-block.tsx` and `chat-message.tsx`
 * deliberately did while they were the only two — "six lines, two callers, and
 * no behaviour rides on the two agreeing". The image and file blocks make four,
 * and four copies of a rounding rule do start to disagree.
 */
export function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
