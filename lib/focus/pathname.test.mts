import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { documentIdFromPathname } from "./pathname.ts";

describe("documentIdFromPathname", () => {
  it("reads the id off a document route", () => {
    assert.equal(documentIdFromPathname("/documents/abc-123"), "abc-123");
  });

  it("reads the id off a document route with a trailing segment", () => {
    assert.equal(documentIdFromPathname("/documents/abc-123/whatever"), "abc-123");
  });

  it("is null for the document list", () => {
    assert.equal(documentIdFromPathname("/"), null);
  });

  it("is null for an unrelated route", () => {
    assert.equal(documentIdFromPathname("/join"), null);
  });
});
