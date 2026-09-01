/**
 * The guard every upload endpoint runs before a byte is stored.
 *
 * It lives here rather than in one route because there are now two of them —
 * chat attachments (FR-060-02) and document file blocks (FR-022-13) — and the
 * rules below are the kind that are only right if they are the same in both
 * places. A second copy would drift the first time one of them was tuned.
 *
 * Web `Request`, not `NextRequest`, and a plain result object rather than a
 * `Response`: this way the rule is testable with nothing but `new Request(…)`,
 * and each route still phrases its own refusal.
 */

/**
 * 25 MB. Nothing in the SRS names a number; this one is chosen to be larger
 * than the screenshots and documents this is for and small enough that the
 * whole thing sitting in memory during the parse is not a problem for a
 * workspace `docs/SRS-ko.md` §2.4 sizes at eight people.
 */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export type UploadResult =
  | { ok: true; file: File }
  | { ok: false; status: 400 | 411 | 413; error: string };

/**
 * The `file` field of a `multipart/form-data` body, once it has passed every
 * check that has to happen before the bytes are trusted.
 *
 * Both size checks happen before parsing, because `formData()` reads the entire
 * body into memory first — once it resolves, refusing is too late to have saved
 * anything.
 *
 * A declared length is *required*, not merely inspected. Without one the
 * request is chunked, nothing bounds it, and the body is fully buffered before
 * `file.size` below can object — so an oversized upload costs the memory
 * whether or not it is ultimately refused. With one, Node reads exactly that
 * many bytes as the body, so this check bounds what parsing can cost. It
 * excludes no real client: `fetch` computes the length for a `FormData` body.
 */
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

/**
 * PDF's magic number. Every PDF begins `%PDF-` followed by its version
 * (ISO 32000-1 §7.5.2), and the byte sequence is ASCII, so this needs no
 * decoding of a file that may well not be text at all.
 *
 * This is *not* what makes serving a PDF inline safe — `lib/files/serving.ts`
 * explains what does, and it holds whether or not this check exists. What this
 * buys is a refusal at the point a person can still do something about it: a
 * `.docx` renamed `.pdf`, or a client that claimed the wrong MIME type, is
 * turned away with a message instead of becoming a block that renders an error
 * for everyone in the workspace forever.
 */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];

export function looksLikePdf(bytes: Uint8Array): boolean {
  return PDF_MAGIC.every((byte, index) => bytes[index] === byte);
}
