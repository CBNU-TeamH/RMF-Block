import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createChecklist,
  createCode,
  createDivider,
  createHeading,
  createList,
  createPdf,
  createQuote,
  createText,
} from "./create.ts";
import { BLOCK_KINDS, continuationBlock, isTextBearing } from "./registry.ts";
import type { Block, BlockType } from "./types.ts";

/**
 * The table's job is to be the *only* place that knows what a block type is,
 * so what these test is agreement: between the table and the union it is keyed
 * by, and between the table and the behaviour the editor reads off it.
 *
 * The strongest guarantee here is not a test at all — a missing key does not
 * compile. These cover what types cannot: that the entries say the right thing.
 */

/** Every type in `docs/design/document-editing.md` §4.1, written out. A test
 *  that derived this list from `BLOCK_KINDS` would agree with itself. */
const ALL_TYPES: Array<BlockType> = [
  "text",
  "heading",
  "list",
  "checklist",
  "quote",
  "code",
  "divider",
  "file",
  "image",
  "pdf",
  "doc-link",
  "block-link",
];

const TEXT_BEARING: Array<BlockType> = [
  "text",
  "heading",
  "list",
  "checklist",
  "quote",
  "code",
];

describe("BLOCK_KINDS", () => {
  it("covers the twelve types and nothing else", () => {
    assert.deepEqual(Object.keys(BLOCK_KINDS).sort(), [...ALL_TYPES].sort());
  });

  it("gives every type a surface", () => {
    for (const type of ALL_TYPES) {
      assert.ok(BLOCK_KINDS[type].surface, type);
    }
  });

  it("marks a type `text` exactly when the block carries text", () => {
    // The invariant `isTextBearing`'s narrowing rests on. `Kind` enforces it at
    // compile time; this is the runtime half, so a table edited without running
    // the type checker still fails loudly.
    for (const type of ALL_TYPES) {
      assert.equal(
        BLOCK_KINDS[type].surface === "text",
        TEXT_BEARING.includes(type),
        type,
      );
    }
  });
});

describe("isTextBearing", () => {
  it("accepts the six that edit through the textarea", () => {
    const blocks: Array<Block> = [
      createText(),
      createHeading(1),
      createList("ordered"),
      createChecklist(),
      createQuote(),
      createCode(),
    ];

    for (const block of blocks) {
      assert.equal(isTextBearing(block), true, block.type);
    }
  });

  it("refuses the ones with no editing surface", () => {
    const blocks: Array<Block> = [
      createDivider(),
      createPdf({ fileId: "f", fileName: "a.pdf", size: 1 }),
      { id: "x", type: "doc-link", documentId: "d" },
      { id: "y", type: "block-link", documentId: "d", blockId: "b" },
      { id: "z", type: "file", fileId: "f", fileName: "a.docx", fileType: "x", size: 1 },
      { id: "w", type: "image", fileId: "f", fileName: "a.png", size: 1 },
    ];

    for (const block of blocks) {
      assert.equal(isTextBearing(block), false, block.type);
    }
  });
});

describe("continuationBlock", () => {
  it("keeps a running list running, at the same style and depth", () => {
    const next = continuationBlock(createList("ordered", 2));

    assert.equal(next.type, "list");
    assert.equal(next.type === "list" && next.style, "ordered");
    assert.equal(next.type === "list" && next.depth, 2);
  });

  it("keeps a checklist and a quote going", () => {
    assert.equal(continuationBlock(createChecklist()).type, "checklist");
    assert.equal(continuationBlock(createQuote()).type, "quote");
  });

  it("leaves plain text after everything else", () => {
    // Including a heading and a code block: Enter ends those rather than
    // repeating them, which is what `createText` here means.
    for (const block of [createText(), createHeading(2), createCode(), createDivider()]) {
      assert.equal(continuationBlock(block).type, "text", block.type);
    }
  });

  it("gives a text block when there is no original at all", () => {
    // A real caller state: the editor looks the original up in a `blocks`
    // array a peer may already have removed it from.
    assert.equal(continuationBlock(undefined).type, "text");
  });

  it("never hands back the block it was given", () => {
    const original = createList("unordered");
    const next = continuationBlock(original);

    assert.notEqual(next.id, original.id);
  });
});
