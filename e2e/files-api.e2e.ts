import type { APIRequestContext } from "@playwright/test";

import { expect, test } from "./fixtures";
import { createDocument, sendChatFile } from "./helpers";

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

  const over = png(LIMIT + 1);
  const atLimit = await upload(api, documentId, "limit.png", "image/png", over.subarray(0, LIMIT));
  expect(atLimit.status(), await atLimit.text()).toBe(201);
  expect(((await atLimit.json()) as Stored).size).toBe(LIMIT);

  const tooBig = await upload(api, documentId, "over.png", "image/png", over);
  expect(tooBig.status()).toBe(413);
  expect(await tooBig.json()).toEqual({ error: "파일은 25MB 이하만 첨부할 수 있습니다." });

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

/**
 * STC-050-004: how a stored file is served. Only the allowed types are shown inline, under their own
 * type; a download is always an opaque attachment; both forbid sniffing and shared caches; a Korean
 * name survives in `filename*`. A name carrying a line break never gets as far as a header: it breaks
 * the multipart part it rides in, and the upload is refused. Stripping one from a stored name is
 * `serving.ts`'s, pinned by its unit test.
 */
test("files are served inline only for allowed types, downloads are always attachments, and a name cannot reach a header (FR-050-03, FR-050-04)", async ({ users }) => {
  const api = (await users.join(0)).context.request;
  const stamp = Date.now();
  const sent = async (name: string, mimeType: string, buffer: Buffer) => (await sendChatFile(api, { name, mimeType, buffer })).fileId;
  const image = await sent(`사진 ${stamp}.png`, "image/png", png(64));
  const svg = await sent(`e2e-${stamp}.svg`, "image/svg+xml", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'));
  const html = await sent(`e2e-${stamp}.html`, "text/html", Buffer.from("<script>alert(1)</script>"));
  const injected = await api.post("/api/chat/files", {
    multipart: { file: { name: `e2e-${stamp}\r\nX-Injected: 1.png`, mimeType: "image/png", buffer: png(64) } },
  });
  expect(injected.status()).toBe(400);

  const preview = await api.get(`/api/files/${image}/preview`);
  expect(preview.status()).toBe(200);
  expect(preview.headers()["content-type"]).toBe("image/png");
  expect(preview.headers()["content-disposition"]).toBe(`inline; filename*=UTF-8''${encodeURIComponent(`사진 ${stamp}.png`)}`);
  expect(preview.headers()["x-content-type-options"]).toBe("nosniff");
  expect(preview.headers()["cache-control"]).toBe("private, max-age=3600");

  for (const id of [svg, html]) expect((await api.get(`/api/files/${id}/preview`)).status()).toBe(404);

  for (const id of [image, svg, html]) {
    const download = await api.get(`/api/files/${id}/download`);
    expect(download.status()).toBe(200);
    expect(download.headers()["content-type"]).toBe("application/octet-stream");
    expect(download.headers()["content-disposition"]).toMatch(/^attachment; filename\*=UTF-8''/);
    expect(download.headers()["x-content-type-options"]).toBe("nosniff");
    expect(download.headers()["cache-control"]).toBe("private, max-age=3600");
  }
});

/** STC-050-006: the file list, a preview and a download all need a workspace session. Whether the
 *  refusal comes before Yorkie is asked is not observable from outside and is not claimed here. */
test("the file list, previews and downloads refuse a request without a session (NFR-SEC-002)", async ({ users, playwright }) => {
  const api = (await users.join(0)).context.request;
  const { fileId } = await sendChatFile(api, { name: `e2e-${Date.now()}.png`, mimeType: "image/png", buffer: png(64) });
  const stranger = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  try {
    for (const path of ["/api/files", `/api/files/${fileId}/preview`, `/api/files/${fileId}/download`]) {
      const refused = await stranger.get(path);
      expect(refused.status(), path).toBe(401);
      expect(await refused.json()).toEqual({ error: "no workspace session" });
    }
  } finally {
    await stranger.dispose();
  }
});
