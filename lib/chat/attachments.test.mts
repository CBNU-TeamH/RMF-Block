import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { kindOf, sharedFiles } from "./attachments.ts";
import type { ChatMessage } from "./types.ts";

const message = (id: string, sentAt: string, fileType?: string): ChatMessage => ({
  id,
  sender: `user-${id}`,
  text: fileType ? "" : "hello",
  sentAt,
  ...(fileType ? { attachment: { fileId: `f-${id}`, fileName: `${id}.bin`, fileType, size: 1 } } : {}),
});

describe("kindOf", () => {
  it("sorts by the stored type into UC-061's three tabs", () => {
    assert.equal(kindOf("image/png"), "image");
    assert.equal(kindOf("application/pdf"), "pdf");
    assert.equal(kindOf("application/zip"), "document");
    assert.equal(kindOf(""), "document");
  });

  it("calls an image an image even when the preview route will not serve it", () => {
    assert.equal(kindOf("image/svg+xml"), "image");
  });
});

describe("sharedFiles", () => {
  it("skips text-only messages and groups the rest, newest first", () => {
    const groups = sharedFiles([
      message("1", "2026-10-06T01:00:00.000Z", "image/png"),
      message("2", "2026-10-06T02:00:00.000Z"),
      message("3", "2026-10-06T03:00:00.000Z", "image/jpeg"),
      message("4", "2026-10-06T04:00:00.000Z", "application/pdf"),
      message("5", "2026-10-06T05:00:00.000Z", "text/plain"),
    ]);

    assert.deepEqual(
      groups.image.map((file) => file.messageId),
      ["3", "1"],
    );
    assert.deepEqual(
      groups.pdf.map((file) => file.messageId),
      ["4"],
    );
    assert.deepEqual(
      groups.document.map((file) => file.messageId),
      ["5"],
    );
  });

  it("carries the sender and send time FR-061-02 shows", () => {
    const [file] = sharedFiles([message("1", "2026-10-06T01:00:00.000Z", "image/png")]).image;
    assert.equal(file.sender, "user-1");
    assert.equal(file.sentAt, "2026-10-06T01:00:00.000Z");
    assert.equal(file.attachment.fileId, "f-1");
  });

  it("answers three empty tabs for an empty history", () => {
    assert.deepEqual(sharedFiles([]), { image: [], pdf: [], document: [] });
  });
});
