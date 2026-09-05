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
