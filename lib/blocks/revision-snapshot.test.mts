import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { readRevisionBlocks } from "./revision-snapshot.ts";

/**
 * Captured from a running Yorkie 0.7.13 by `createRevision` + `getRevision`, not
 * hand-written: the characters this file exists for are exactly the ones a
 * hand-written sample would be tempted to leave out. `String.raw` because the
 * snapshot carries JSON's own `\"` and `\\` escapes.
 */
const REAL_SNAPSHOT = String.raw`{"blocks":[{"content":{"level":Int(2),"text":Text([{"val":"회의록 (9월)"}])},"id":"b1","type":"heading"},{"content":{"text":Text([{"val":"f(x) = [1] \"인용\" \\ 끝 ]"}])},"id":"b2","type":"text"},{"content":{"depth":Int(1),"style":"unordered","text":Text([{"val":"첫 항목"}])},"id":"b3","type":"list"},{"content":{"checked":true,"text":Text([{"val":"할 일 (확인)"}])},"id":"b4","type":"checklist"},{"id":"b5","type":"divider"},{"content":{"fileId":"f1","fileName":"보고서 (최종).pdf","size":Int(2048)},"id":"b6","type":"pdf"}]}`;

describe("readRevisionBlocks", () => {
  it("reads every block type in a real snapshot, in order", () => {
    const blocks = readRevisionBlocks(REAL_SNAPSHOT);

    assert.deepEqual(
      blocks.map((block) => block.type),
      ["heading", "text", "list", "checklist", "divider", "pdf"],
    );
  });

  it("preserves characters the server's own restore used to corrupt", () => {
    // `yorkie.YSON.parse` used to throw on the bracket below and, separately,
    // the server's `restoreRevision` used to rewrite the `)` in the file name
    // to `}` — both fixed upstream (yorkie-team/yorkie#1967), and this is now a
    // regression test for that fix rather than a test of a hand-rolled scanner.
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

  it("drops an entry whose id cannot address a block", () => {
    // `readBlocks` copies an id through without looking at it, and a restore
    // writes these into the live document, where the id is the only handle.
    const yson = `{"blocks":[{"type":"text"},{"id":"","type":"text"},{"id":7,"type":"text"},{"id":"b1","type":"text","content":{"text":Text([{"val":"kept"}])}}]}`;

    const blocks = readRevisionBlocks(yson);

    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].id, "b1");
  });

  it("keeps the first of a duplicated id and drops the rest", () => {
    // `editBlockText` resolves by id, so a duplicate would pour the second
    // block's text into the first.
    const yson = `{"blocks":[{"id":"b1","type":"text","content":{"text":Text([{"val":"first"}])}},{"id":"b1","type":"text","content":{"text":Text([{"val":"second"}])}}]}`;

    const blocks = readRevisionBlocks(yson);

    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].type === "text" && blocks[0].text, "first");
  });

  it("throws on a text node that lost its value, rather than silently dropping it", () => {
    // The old hand-rolled reader coerced a missing `val` to "" and kept going.
    // `yorkie.YSON.parse` treats it as invalid YSON grammar instead — a real
    // behaviour change from switching to the SDK's own parser. Both call sites
    // (`version-history.tsx`'s preview `.catch()` and its `withBusy` wrapper
    // around restore) already turn a thrown error into a visible failure
    // state, so this is a stricter, still-safe default rather than a gap.
    const yson = `{"blocks":[{"id":"b1","type":"text","content":{"text":Text([{"val":null},{"val":"tail"}])}}]}`;

    assert.throws(() => readRevisionBlocks(yson));
  });
});
