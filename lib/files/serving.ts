/**
 * The rule that decides what a response may claim an uploaded file is.
 *
 * Hosting bytes someone else chose, on our own origin, has one serious failure
 * mode: **a file the browser treats as active content.** An uploaded `.html`
 * echoed back as `text/html` runs *in our origin*, where the session cookie
 * lives.
 *
 * Blocking extensions at upload does not close it — `.exe` is harmless at rest,
 * `.html` renamed to `.txt` is not caught, and a blacklist has to stay right
 * forever. The decision belongs where it is decidable, at response time, from
 * state we hold. wafflebase hit this first; their `generic-file-upload.md` is
 * where the shape of this came from.
 *
 * Two endpoints rather than one branching on a stored value:
 *
 * - `download` never reads the stored type, so no upload can change the shape
 *   of its response. There is no `if` to get wrong.
 * - `preview` must name a real type for `<img>` to work at all, so it is the
 *   one that needs a list — and it refuses everything not on it.
 */

/**
 * The types `preview` will serve inline. Four literals rather than
 * `startsWith("image/")` **because of SVG**: `image/svg+xml` is an image that
 * can carry `<script>`, and served inline it runs.
 */
const INLINE_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export function isInlineImageType(type: string): boolean {
  return INLINE_IMAGE_TYPES.has(type);
}

/**
 * Headers every file response carries.
 *
 * `nosniff` is the other half of the list and not optional. The stored type is
 * whatever the uploading client claimed, so an HTML file can be uploaded *as*
 * `image/png` and pass. `nosniff` stops the browser re-deciding the type from
 * the bytes, so it tries to draw a PNG, fails, and shows a broken image rather
 * than a page. The list stops us naming a dangerous type; `nosniff` stops the
 * browser overriding a safe one — neither is sufficient alone.
 *
 * `private` because a file belongs to one workspace and these responses pass
 * through whatever the LAN has in front of them.
 */
function baseHeaders(contentType: string, disposition: string): Headers {
  return new Headers({
    "Content-Type": contentType,
    "Content-Disposition": disposition,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, max-age=3600",
  });
}

/** `inline`, with the stored type — only ever called after the list said yes. */
export function inlineImageHeaders(type: string): Headers {
  return baseHeaders(type, "inline");
}

/**
 * `attachment`, always opaque. The stored type is not consulted, so there is no
 * input that makes this response renderable.
 */
export function attachmentHeaders(fileName: string): Headers {
  return baseHeaders("application/octet-stream", `attachment; ${dispositionName(fileName)}`);
}

/**
 * RFC 5987 `filename*`, percent-encoded, with anything that could end the
 * header line removed first — a crafted name must not be able to inject one.
 *
 * `filename*` alone, without an ASCII `filename=` beside it: every browser this
 * project supports (`docs/SRS-ko.md` §4.2) reads it, and a second copy of the
 * name is a second thing to escape correctly.
 */
function dispositionName(fileName: string): string {
  const safe = fileName.replace(/[\r\n]/g, "").trim() || "file";

  return `filename*=UTF-8''${encodeURIComponent(safe)}`;
}
