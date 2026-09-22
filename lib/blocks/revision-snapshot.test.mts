import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { readRevisionBlocks, ysonToJson } from "./revision-snapshot.ts";

/**
 * Captured from a running Yorkie 0.7.13 by `createRevision` + `getRevision`, not
 * hand-written: the characters this file exists for are exactly the ones a
 * hand-written sample would be tempted to leave out. `String.raw` because the
 * snapshot carries JSON's own `\"` and `\\` escapes.
 */
const REAL_SNAPSHOT = String.raw`{"blocks":[{"content":{"level":Int(2),"text":Text([{"val":"회의록 (9월)"}])},"id":"b1","type":"heading"},{"content":{"text":Text([{"val":"f(x) = [1] \"인용\" \\ 끝 ]"}])},"id":"b2","type":"text"},{"content":{"depth":Int(1),"style":"unordered","text":Text([{"val":"첫 항목"}])},"id":"b3","type":"list"},{"content":{"checked":true,"text":Text([{"val":"할 일 (확인)"}])},"id":"b4","type":"checklist"},{"id":"b5","type":"divider"},{"content":{"fileId":"f1","fileName":"보고서 (최종).pdf","size":Int(2048)},"id":"b6","type":"pdf"}]}`;

describe("ysonToJson", () => {
  it("turns a real snapshot into something JSON.parse accepts", () => {
    const json = ysonToJson(REAL_SNAPSHOT);

    assert.doesNotThrow(() => JSON.parse(json));
  });

  it("drops the wrapper and keeps its payload", () => {
    assert.equal(ysonToJson(`{"a":Int(2)}`), `{"a":2}`);
    assert.equal(ysonToJson(`{"t":Text([{"val":"hi"}])}`), `{"t":[{"val":"hi"}]}`);
  });

  it("leaves a parenthesis inside a string alone", () => {
    // The bug this function exists for. Yorkie's own restore reads the `)` in
    // a file name as the end of a `Text(` and rewrites it to `}`.
    const yson = `{"n":"보고서 (최종).pdf","t":Text([{"val":"f(x) = y"}])}`;

    assert.equal(
      ysonToJson(yson),
      `{"n":"보고서 (최종).pdf","t":[{"val":"f(x) = y"}]}`,
    );
  });

  it("leaves an unbalanced bracket inside a string alone", () => {
    // `yorkie.YSON.parse` throws on this one — its `Text(...)` pattern is
    // bracket-counted and has no idea it is inside a string literal.
    const yson = `{"t":Text([{"val":"close ] alone"}])}`;

    assert.equal(ysonToJson(yson), `{"t":[{"val":"close ] alone"}]}`);
  });

  it("does not mistake an escaped quote for the end of a string", () => {
    const yson = String.raw`{"t":Text([{"val":"say \"hi\" )"}])}`;

    assert.equal(
      ysonToJson(yson),
      String.raw`{"t":[{"val":"say \"hi\" )"}]}`,
    );
  });

  it("keeps a parenthesis that no wrapper opened", () => {
    assert.equal(ysonToJson(`{"a":"(x)"}`), `{"a":"(x)"}`);
  });
});

describe("readRevisionBlocks", () => {
  it("reads every block type in a real snapshot, in order", () => {
    const blocks = readRevisionBlocks(REAL_SNAPSHOT);

    assert.deepEqual(
      blocks.map((block) => block.type),
      ["heading", "text", "list", "checklist", "divider", "pdf"],
    );
  });

  it("preserves characters the server's own restore corrupts", () => {
    const blocks = readRevisionBlocks(REAL_SNAPSHOT);
    const text = blocks[1];
    const pdf = blocks[5];

    assert.equal(text.type === "text" && text.text, 'f(x) = [1] "인용" \\ 끝 ]');
    assert.equal(pdf.type === "pdf" && pdf.fileName, "보고서 (최종).pdf");
  });

  it("carries the fields each type needs past the flattening", () => {
    const [heading, , list, checklist] = readRevisionBlocks(REAL_SNAPSHOT);

    assert.equal(heading.type === "heading" && heading.level, 2);
    assert.equal(heading.type === "heading" && heading.text, "회의록 (9월)");
    assert.equal(list.type === "list" && list.style, "unordered");
    assert.equal(list.type === "list" && list.depth, 1);
    assert.equal(checklist.type === "checklist" && checklist.checked, true);
    assert.equal(checklist.type === "checklist" && checklist.text, "할 일 (확인)");
  });

  it("joins a text split across nodes, in order", () => {
    // What a `Text` looks like after a few separate edits.
    const yson = `{"blocks":[{"id":"b1","type":"text","content":{"text":Text([{"val":"one "},{"val":"two "},{"val":"three"}])}}]}`;

    const [block] = readRevisionBlocks(yson);

    assert.equal(block.type === "text" && block.text, "one two three");
  });

  it("returns nothing for the empty snapshot a revision made before a sync", () => {
    // Measured: `createRevision` snapshots the server's view, so calling it
    // before `client.sync()` stores `{}` and nothing complains.
    assert.deepEqual(readRevisionBlocks("{}"), []);
  });

  it("returns nothing when blocks is not an array", () => {
    assert.deepEqual(readRevisionBlocks(`{"blocks":"nope"}`), []);
  });

  it("drops a malformed entry rather than the whole snapshot", () => {
    const yson = `{"blocks":[null,{"id":"b1","type":"nonsense"},{"id":"b2","type":"text","content":{"text":Text([{"val":"kept"}])}}]}`;

    const blocks = readRevisionBlocks(yson);

    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].type === "text" && blocks[0].text, "kept");
  });

  it("reads a block whose text node lost its value", () => {
    const yson = `{"blocks":[{"id":"b1","type":"text","content":{"text":Text([{"val":null},{"val":"tail"}])}}]}`;

    const [block] = readRevisionBlocks(yson);

    assert.equal(block.type === "text" && block.text, "tail");
  });
});
