/** What a response may claim an uploaded file is. Why two endpoints rather than
 *  one: `docs/design/api.md`, "Why preview and download are two endpoints". */

/** Literals, never `startsWith("image/")` — `image/svg+xml` is an image that can
 *  carry `<script>`, and inline it runs. */
const INLINE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
]);

export function isInlineType(type: string): boolean {
  return INLINE_TYPES.has(type);
}

/** `nosniff` is not optional — a chat upload's stored type is whatever the
 *  client claimed, while a document upload's is server-verified
 *  (`docs/design/api.md`), and this stops the browser re-deciding either from
 *  the bytes. Why `private`: the same doc. */
function baseHeaders(contentType: string, disposition: string): Headers {
  return new Headers({
    "Content-Type": contentType,
    "Content-Disposition": disposition,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, max-age=3600",
  });
}

/** `inline`, with the stored type — only called after the list said yes. The
 *  name rides along so the viewer's Save button does not write the bare uuid. */
export function inlineHeaders(type: string, fileName: string): Headers {
  return baseHeaders(type, `inline; ${dispositionName(fileName)}`);
}

/** `attachment`, always opaque — the stored type is never consulted, so no
 *  upload can make this response renderable. */
export function attachmentHeaders(fileName: string): Headers {
  return baseHeaders("application/octet-stream", `attachment; ${dispositionName(fileName)}`);
}

/** RFC 5987 `filename*`, percent-encoded, with line terminators stripped first
 *  so a crafted name cannot inject a header. */
function dispositionName(fileName: string): string {
  const safe = fileName.replace(/[\r\n]/g, "").trim() || "file";

  return `filename*=UTF-8''${encodeURIComponent(safe)}`;
}
