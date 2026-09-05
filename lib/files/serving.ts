/**
 * What a response may claim an uploaded file is.
 *
 * Why this is two endpoints rather than one branching on a stored type, and why
 * a blacklist at upload time does not work: `docs/design/api.md`, "Why preview
 * and download are two endpoints".
 */

/**
 * The types `preview` will serve inline.
 *
 * Literals, never `startsWith("image/")`: `image/svg+xml` is an image that can
 * carry `<script>`, and served inline it runs. `application/pdf` is safe here
 * for a reason specific to PDFs — see `docs/design/api.md`.
 */
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

/**
 * Headers every file response carries.
 *
 * `nosniff` is not optional: the stored type is whatever the uploading client
 * claimed, and this is what stops the browser re-deciding it from the bytes.
 *
 * `private` because these responses cross a LAN that may have caches of its own
 * in front of them, and a file belongs to one workspace.
 */
function baseHeaders(contentType: string, disposition: string): Headers {
  return new Headers({
    "Content-Type": contentType,
    "Content-Disposition": disposition,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, max-age=3600",
  });
}

/**
 * `inline`, with the stored type — only ever called after the list said yes.
 *
 * The name is carried too: a PDF opened in the browser's own viewer offers a
 * Save button, and without it the file saves under the opaque uuid it is
 * stored as.
 */
export function inlineHeaders(type: string, fileName: string): Headers {
  return baseHeaders(type, `inline; ${dispositionName(fileName)}`);
}

/** `attachment`, always opaque — the stored type is never consulted, so no
 *  upload can make this response renderable. */
export function attachmentHeaders(fileName: string): Headers {
  return baseHeaders("application/octet-stream", `attachment; ${dispositionName(fileName)}`);
}

/**
 * RFC 5987 `filename*`, percent-encoded, with anything that could end the
 * header line stripped first — a crafted name must not be able to inject one.
 */
function dispositionName(fileName: string): string {
  const safe = fileName.replace(/[\r\n]/g, "").trim() || "file";

  return `filename*=UTF-8''${encodeURIComponent(safe)}`;
}
