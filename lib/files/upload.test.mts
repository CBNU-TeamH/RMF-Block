import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MAX_UPLOAD_BYTES, detectImageType, looksLikePdf, readUpload } from "./upload.ts";

/**
 * `fetch` sets `content-length` for a `FormData` body and `new Request(…)` does
 * not, so these build the request the way the network delivers one — header set
 * explicitly — rather than the way the constructor leaves it.
 */
async function upload(file: File | null, headers: Record<string, string> = {}) {
  const form = new FormData();
  if (file) form.append("file", file);

  const encoded = new Response(form);
  const contentType = encoded.headers.get("content-type")!;
  const body = await encoded.arrayBuffer();

  return new Request("http://localhost/api/documents/x/files", {
    method: "POST",
    headers: {
      "content-type": contentType,
      "content-length": String(body.byteLength),
      ...headers,
    },
    body,
  });
}

describe("readUpload", () => {
  it("returns the file when the request is well formed", async () => {
    const result = await readUpload(await upload(new File(["hello"], "a.pdf")));

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.file.name, "a.pdf");
  });

  it("refuses a body whose length was never declared", async () => {
    // Not a formality: without a length the request is chunked, and nothing
    // bounds what parsing it costs.
    const result = await readUpload(
      await upload(new File(["hi"], "a.pdf"), { "content-length": "" }),
    );

    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.status, 411);
  });

  it("refuses an oversized body before parsing it", async () => {
    const result = await readUpload(
      await upload(new File(["hi"], "a.pdf"), {
        "content-length": String(MAX_UPLOAD_BYTES + 1),
      }),
    );

    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.status, 413);
  });

  it("refuses a form with no file field", async () => {
    const result = await readUpload(await upload(null));

    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.status, 400);
  });

  it("refuses an empty file", async () => {
    const result = await readUpload(await upload(new File([], "a.pdf")));

    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.status, 400);
  });

  it("refuses a body that is not a form at all", async () => {
    const request = new Request("http://localhost/api/documents/x/files", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "2" },
      body: "{}",
    });

    const result = await readUpload(request);

    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.status, 400);
  });
});

describe("looksLikePdf", () => {
  it("accepts the header every PDF starts with", () => {
    assert.equal(looksLikePdf(new TextEncoder().encode("%PDF-1.7")), true);
  });

  it("refuses a file that only claims to be one", () => {
    // The case this exists for: a `.docx` renamed, or a client sending
    // `application/pdf` for something else entirely.
    for (const head of ["PK", "<!doctype html>", "%PD", "", " %PDF-"]) {
      assert.equal(looksLikePdf(new TextEncoder().encode(head)), false, JSON.stringify(head));
    }
  });
});

describe("detectImageType", () => {
  const bytes = (...values: Array<number>) => Uint8Array.from(values);
  const png = () => bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x11);
  const webp = () =>
    bytes(0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50);

  it("names each format this project serves inline", () => {
    assert.equal(detectImageType(png()), "image/png");
    assert.equal(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0)), "image/jpeg");
    assert.equal(detectImageType(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61)), "image/gif");
    assert.equal(detectImageType(webp()), "image/webp");
  });

  it("refuses HTML, whatever the request called it", () => {
    // The upload this exists to stop: a page stored as `image/png` would be
    // served inline by `serving.ts`, and would run.
    assert.equal(detectImageType(new TextEncoder().encode("<html><script>")), null);
  });

  it("refuses SVG — an image, but one that can carry a script", () => {
    assert.equal(detectImageType(new TextEncoder().encode("<svg xmlns=")), null);
  });

  it("refuses a PDF, which has its own block", () => {
    assert.equal(detectImageType(new TextEncoder().encode("%PDF-1.7")), null);
  });

  it("refuses a WAV, which opens RIFF exactly as a WebP does", () => {
    const wav = bytes(0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45);
    assert.equal(detectImageType(wav), null);
  });

  it("refuses a file too short to carry a magic number", () => {
    assert.equal(detectImageType(bytes(0x89, 0x50)), null);
    assert.equal(detectImageType(bytes()), null);
  });

  it("refuses bytes that merely contain a magic number later on", () => {
    assert.equal(detectImageType(bytes(0x00, 0x89, 0x50, 0x4e, 0x47)), null);
  });
});
