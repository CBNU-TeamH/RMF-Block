import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  attachmentHeaders,
  inlineHeaders,
  isInlineType,
} from "./serving.ts";

/**
 * The rule these tests pin is the one thing standing between an uploaded
 * `.html` and a page running on our origin, so they are written as the attacks
 * rather than as the happy path.
 */

describe("isInlineType", () => {
  it("allows the four image types a browser draws and cannot script", () => {
    for (const type of ["image/png", "image/jpeg", "image/gif", "image/webp"]) {
      assert.equal(isInlineType(type), true, type);
    }
  });

  it("allows PDF, which the browser renders in a viewer of its own", () => {
    // The PDF block's `<iframe>` (FR-080-01~03). Unlike an SVG's, a PDF's
    // scripting runs in the browser's viewer rather than in this origin.
    assert.equal(isInlineType("application/pdf"), true);
  });

  it("refuses SVG — an image that can carry a script", () => {
    // The whole reason this is a list of literals instead of
    // `startsWith("image/")`. An `<svg>` with a `<script>` inside runs when it
    // is served inline.
    assert.equal(isInlineType("image/svg+xml"), false);
  });

  it("refuses the types that would execute", () => {
    for (const type of [
      "text/html",
      "application/xhtml+xml",
      "text/javascript",
      "application/javascript",
    ]) {
      assert.equal(isInlineType(type), false, type);
    }
  });

  it("is not fooled by a type that merely starts with an allowed one", () => {
    for (const type of [
      "image/png; charset=utf-8",
      "image/pngx",
      " image/png",
      "IMAGE/PNG",
      "application/pdfx",
    ]) {
      assert.equal(isInlineType(type), false, type);
    }
  });

  it("refuses an empty or missing type", () => {
    assert.equal(isInlineType(""), false);
  });
});

describe("attachmentHeaders", () => {
  it("never names anything but octet-stream", () => {
    // No input changes this. That is what makes the endpoint safe rather than
    // any check it performs.
    for (const name of ["a.html", "a.svg", "a.png", "a.exe"]) {
      assert.equal(
        attachmentHeaders(name).get("Content-Type"),
        "application/octet-stream",
        name,
      );
    }
  });

  it("always downloads rather than displays", () => {
    assert.match(attachmentHeaders("a.png").get("Content-Disposition")!, /^attachment;/);
  });

  it("carries the original name, percent-encoded", () => {
    assert.equal(
      attachmentHeaders("보고서 (최종).pdf").get("Content-Disposition"),
      `attachment; filename*=UTF-8''${encodeURIComponent("보고서 (최종).pdf")}`,
    );
  });

  it("cannot be made to inject a response header", () => {
    // A name is whatever the uploader typed. A CR or LF would end the header
    // line and start another one of their choosing.
    const header = attachmentHeaders(
      "a.png\r\nSet-Cookie: stolen=1\r\nX-Bad: yes",
    ).get("Content-Disposition")!;

    assert.equal(header.includes("\r"), false, "no carriage return survives");
    assert.equal(header.includes("\n"), false, "no line feed survives");

    // The words "Set-Cookie" remain, and that is fine — they are part of a
    // filename now. What matters is that the `:` after them is encoded, so
    // nothing in the value can read as a header even if the line were split.
    const value = header.slice(header.indexOf("''") + 2);
    assert.equal(value.includes(":"), false, "no bare colon inside the filename");
    assert.match(header, /^attachment; filename\*=UTF-8''/);
  });

  it("falls back to a name rather than emitting an empty one", () => {
    for (const name of ["", "   ", "\r\n"]) {
      assert.equal(
        attachmentHeaders(name).get("Content-Disposition"),
        "attachment; filename*=UTF-8''file",
        JSON.stringify(name),
      );
    }
  });
});

describe("inlineHeaders", () => {
  it("serves the file inline under its own type", () => {
    const headers = inlineHeaders("image/png", "shot.png");

    assert.equal(headers.get("Content-Type"), "image/png");
    assert.match(headers.get("Content-Disposition")!, /^inline;/);
  });

  it("carries the original name, so the viewer's Save button uses it", () => {
    assert.equal(
      inlineHeaders("application/pdf", "보고서 (최종).pdf").get("Content-Disposition"),
      `inline; filename*=UTF-8''${encodeURIComponent("보고서 (최종).pdf")}`,
    );
  });

  it("cannot be made to inject a response header either", () => {
    const header = inlineHeaders("application/pdf", "a.pdf\r\nSet-Cookie: stolen=1").get(
      "Content-Disposition",
    )!;

    assert.equal(header.includes("\r"), false, "no carriage return survives");
    assert.equal(header.includes("\n"), false, "no line feed survives");
  });
});

describe("every file response", () => {
  it("forbids the browser sniffing a type of its own", () => {
    // The other half of the list: an HTML file can be uploaded *claiming*
    // `image/png` and pass. `nosniff` is what stops the browser noticing the
    // bytes are HTML and rendering them as a page anyway.
    assert.equal(
      inlineHeaders("image/png", "a.png").get("X-Content-Type-Options"),
      "nosniff",
    );
    assert.equal(attachmentHeaders("a.bin").get("X-Content-Type-Options"), "nosniff");
  });

  it("is not cached by anything shared", () => {
    for (const headers of [inlineHeaders("image/png", "a.png"), attachmentHeaders("a.bin")]) {
      assert.match(headers.get("Cache-Control")!, /private/);
    }
  });
});
