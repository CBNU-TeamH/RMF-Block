import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { headingShortcut } from "./markdown-shortcuts.ts";

describe("headingShortcut", () => {
  it("matches one hash as H1", () => {
    assert.equal(headingShortcut("# "), 1);
  });

  it("matches two hashes as H2", () => {
    assert.equal(headingShortcut("## "), 2);
  });

  it("matches three hashes as H3", () => {
    assert.equal(headingShortcut("### "), 3);
  });

  it("does not match four hashes — SRS caps headings at H3", () => {
    assert.equal(headingShortcut("#### "), null);
  });

  it("does not match without the trailing space", () => {
    assert.equal(headingShortcut("#"), null);
    assert.equal(headingShortcut("##"), null);
  });

  it("does not match once anything follows the marker", () => {
    // The marker as a prefix in front of content that already exists is not
    // a fresh conversion — same reasoning as typing it into the middle of a
    // block that already has text.
    assert.equal(headingShortcut("# hello"), null);
  });

  it("does not match the marker appearing mid-string", () => {
    assert.equal(headingShortcut("he# "), null);
  });

  it("does not match empty or unrelated text", () => {
    assert.equal(headingShortcut(""), null);
    assert.equal(headingShortcut("hello"), null);
  });
});
