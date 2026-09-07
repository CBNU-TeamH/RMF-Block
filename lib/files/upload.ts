/** The guard both upload endpoints run before a byte is stored (FR-060-02,
 *  FR-022-13) — rules that are only right if identical in both. Web `Request`,
 *  not `NextRequest`, so it tests with `new Request(…)`. */

/** 25 MB. The SRS names no number; this clears the screenshots and documents
 *  this is for and still fits in memory during the parse, for the eight-person
 *  workspace `docs/SRS-ko.md` §2.4 sizes. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export type UploadResult =
  | { ok: true; file: File }
  | { ok: false; status: 400 | 411 | 413; error: string };

/** The `file` field of a `multipart/form-data` body, once it is safe to trust.
 *  Size is checked **before** parsing — `formData()` buffers the whole body, so
 *  refusing after it resolves has saved nothing. A declared length is required,
 *  not merely inspected: without one the request is chunked and nothing bounds
 *  the cost. `fetch` computes it for a `FormData` body, so no client is lost. */
export async function readUpload(request: Request): Promise<UploadResult> {
  const declared = Number(request.headers.get("content-length"));
  if (!Number.isFinite(declared) || declared <= 0) {
    return { ok: false, status: 411, error: "업로드 크기를 알 수 없습니다." };
  }
  // The length is still only the uploader's claim about the whole body, so the
  // file's own size is checked again after parsing.
  if (declared > MAX_UPLOAD_BYTES) return tooLarge();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return { ok: false, status: 400, error: "업로드를 읽을 수 없습니다." };
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return { ok: false, status: 400, error: "첨부할 파일이 없습니다." };
  }

  if (file.size > MAX_UPLOAD_BYTES) return tooLarge();
  if (file.size === 0) return { ok: false, status: 400, error: "빈 파일입니다." };

  return { ok: true, file };
}

/** 413, and a message the sender can act on rather than a generic failure. */
function tooLarge(): UploadResult {
  return {
    ok: false,
    status: 413,
    error: `파일은 ${MAX_UPLOAD_BYTES / 1024 / 1024}MB 이하만 첨부할 수 있습니다.`,
  };
}

/** PDF's magic number — `%PDF-` then a version (ISO 32000-1 §7.5.2), ASCII, so
 *  binary input needs no decoding. **Not** what makes inline serving safe
 *  (`serving.ts` is); it buys a refusal while a person can still act on it. */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];

export function looksLikePdf(bytes: Uint8Array): boolean {
  return PDF_MAGIC.every((byte, index) => bytes[index] === byte);
}

/**
 * The image formats a document block may hold, by the bytes that identify them.
 *
 * **Sniffed, never taken from the request.** `serving.ts` answers `inline` for
 * anything whose *stored* type is in its `INLINE_TYPES`, so a stored type the
 * uploader chose would let an HTML file be saved as `image/png` and then served
 * as one — the hole `docs/design/api.md` §1 names. The magic number is what
 * makes the stored type true.
 *
 * The four here are exactly `INLINE_TYPES`' image half. **SVG is deliberately
 * absent**: it is XML that can carry `<script>`, so it is not safe inline and
 * becomes a file block instead (FR-022-13).
 */
const IMAGE_MAGIC: Array<{ type: string; bytes: Array<number>; at?: number }> = [
  { type: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // Every JPEG variant opens SOI + the first marker; what follows differs.
  { type: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { type: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  // RIFF....WEBP — the four bytes between are the file length, so the second
  // half is checked at its own offset rather than as one run.
  { type: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] },
];

const WEBP_TAG = { bytes: [0x57, 0x45, 0x42, 0x50], at: 8 };

/** The image this file actually is, or `null` for anything else — including an
 *  image format this project does not serve inline. */
export function detectImageType(bytes: Uint8Array): string | null {
  const match = IMAGE_MAGIC.find((format) => startsWith(bytes, format.bytes, format.at ?? 0));
  if (!match) return null;

  if (match.type === "image/webp" && !startsWith(bytes, WEBP_TAG.bytes, WEBP_TAG.at)) {
    // RIFF is a container: WAV and AVI open the same way.
    return null;
  }

  return match.type;
}

function startsWith(bytes: Uint8Array, magic: Array<number>, at: number): boolean {
  return magic.every((byte, index) => bytes[at + index] === byte);
}
