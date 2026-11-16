import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { hasMarks, parseInline, SHORTCUT_MARKERS, toggleMarker } from "./inline-markdown.ts";

const runs = (text: string) => parseInline(text).map(({ text, marks, href }) => [text, marks.join("+"), href].filter((x) => x !== undefined).join("|"));

describe("parseInline", () => {
  it("reads bold, italic, underline, strikethrough and code", () => {
    assert.deepEqual(runs("**채용 신분:** 정규직"), ["채용 신분:|bold", " 정규직|"]);
    assert.deepEqual(runs("*a* _b_ <u>c</u> ~~d~~ `e`"), ["a|italic", " |", "b|italic", " |", "c|underline", " |", "d|strike", " |", "e|code"]);
  });

  it("nests marks", () => {
    assert.deepEqual(runs("***both***"), ["both|bold+italic"]);
    assert.deepEqual(runs("**bold *it***"), ["bold |bold", "it|bold+italic"]);
    assert.deepEqual(runs("<u>**x**</u>"), ["x|underline+bold"]);
  });

  it("reads a link, keeping marks inside its text", () => {
    assert.deepEqual(runs("see [**docs**](http://a/b) now"), ["see |", "docs|bold|http://a/b", " now|"]);
  });

  it("leaves what does not close, or opens on a space, as typed", () => {
    assert.deepEqual(runs("**unclosed"), ["**unclosed|"]);
    assert.deepEqual(runs("a * b * c"), ["a * b * c|"]);
  });

  it("reads `*` inside a word, as CommonMark does, but not `_`", () => {
    assert.deepEqual(runs("2*3*4"), ["2|", "3|italic", "4|"]);
    assert.deepEqual(runs("snake_case_name"), ["snake_case_name|"]);
  });

  it("drops the backslash of an escape", () => {
    assert.deepEqual(runs("\\*not italic\\*"), ["*not italic*|"]);
  });

  it("does not read marks inside code", () => {
    assert.deepEqual(runs("`**x**`"), ["**x**|code"]);
  });

  it("says whether there is anything to draw", () => {
    assert.equal(hasMarks(parseInline("plain text")), false);
    assert.equal(hasMarks(parseInline("a **b**")), true);
    assert.equal(hasMarks(parseInline("[a](http://x)")), true);
  });
});

describe("toggleMarker", () => {
  it("wraps the selection and keeps it on the same characters", () => {
    assert.deepEqual(toggleMarker("ab cd", 3, 5, SHORTCUT_MARKERS.b), { text: "ab **cd**", from: 5, to: 7 });
    assert.deepEqual(toggleMarker("x", 0, 1, SHORTCUT_MARKERS.u), { text: "<u>x</u>", from: 3, to: 4 });
  });

  it("unwraps a selection that is already wrapped", () => {
    assert.deepEqual(toggleMarker("ab **cd**", 5, 7, SHORTCUT_MARKERS.b), { text: "ab cd", from: 3, to: 5 });
  });

  it("adds italic to bold, and bold to italic, rather than unwrapping the shared `*`", () => {
    assert.deepEqual(toggleMarker("**x**", 2, 3, SHORTCUT_MARKERS.i), { text: "***x***", from: 3, to: 4 });
    assert.deepEqual(toggleMarker("*x*", 1, 2, SHORTCUT_MARKERS.b), { text: "***x***", from: 3, to: 4 });
  });

  it("removes only the mark asked for from bold italic", () => {
    assert.deepEqual(toggleMarker("***x***", 3, 4, SHORTCUT_MARKERS.i), { text: "**x**", from: 2, to: 3 });
    assert.deepEqual(toggleMarker("***x***", 3, 4, SHORTCUT_MARKERS.b), { text: "*x*", from: 1, to: 2 });
  });

  it("wraps an empty selection, leaving the caret between the markers", () => {
    assert.deepEqual(toggleMarker("ab", 2, 2, SHORTCUT_MARKERS.i), { text: "ab**", from: 3, to: 3 });
  });
});
