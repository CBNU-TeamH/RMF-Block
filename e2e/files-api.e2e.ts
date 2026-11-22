import type { APIRequestContext } from "@playwright/test";

import { expect, test } from "./fixtures";
import { createDocument } from "./helpers";

/** 25 MB, `MAX_UPLOAD_BYTES` in `lib/files/upload.ts`. */
const LIMIT = 25 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

type Stored = { id: string; type: string; size: number };

function upload(api: APIRequestContext, documentId: string, name: string, mimeType: string, buffer: Buffer) {
  return api.post(`/api/documents/${documentId}/files`, { multipart: { file: { name, mimeType, buffer } } });
}

/** A file of `size` bytes that opens with the PNG signature. */
function png(size: number): Buffer {
  const bytes = Buffer.alloc(size);
  PNG_SIGNATURE.copy(bytes);
  return bytes;
}

/**
 * STC-022-016 on the running stack: a file put into a document is stored up to 25 MB and refused
 * past it or empty, and its type comes from its bytes. A file claiming to be an image that is not
 * one is stored as opaque bytes that are never shown inline — D07's expected result, aligned with
 * the design (`docs/design/api.md` §1) on 2026-11-18.
 */
test("a document upload is stored up to 25 MB, refused past it or empty, and typed by its bytes (FR-022-13, FR-022-14)", async ({ users }) => {
  test.setTimeout(90_000);
  const { context, page } = await users.join(0);
  const api = context.request;
  const documentId = await createDocument(page, `e2e uploads ${Date.now()}`);

  const atLimit = await upload(api, documentId, "limit.png", "image/png", png(LIMIT));
  expect(atLimit.status(), await atLimit.text()).toBe(201);
  expect(((await atLimit.json()) as Stored).size).toBe(LIMIT);

  const over = await upload(api, documentId, "over.png", "image/png", png(LIMIT + 1));
  expect(over.status()).toBe(413);
  expect(await over.json()).toEqual({ error: "파일은 25MB 이하만 첨부할 수 있습니다." });

  const empty = await upload(api, documentId, "empty.png", "image/png", Buffer.alloc(0));
  expect(empty.status()).toBe(400);
  expect(await empty.json()).toEqual({ error: "빈 파일입니다." });

  const real = (await (await upload(api, documentId, "real.png", "application/octet-stream", png(64))).json()) as Stored;
  expect(real.type).toBe("image/png");
  expect((await api.get(`/api/files/${real.id}/preview`)).status()).toBe(200);

  const disguised = await upload(api, documentId, "photo.png", "image/png", Buffer.from("<script>alert(1)</script>"));
  expect(disguised.status(), await disguised.text()).toBe(201);
  const stored = (await disguised.json()) as Stored;
  expect(stored.type).toBe("application/octet-stream");
  expect((await api.get(`/api/files/${stored.id}/preview`)).status()).toBe(404);
});
