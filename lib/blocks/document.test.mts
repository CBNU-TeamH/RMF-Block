import assert from "node:assert/strict";
import { describe, it } from "node:test";

import yorkie from "@yorkie-js/sdk";

import type { BlockDocumentRoot, StoredBlock } from "./document.ts";
import { readBlocks } from "./document.ts";

/**
 * `readBlocks` exists for the blocks that are *not* well-formed, so that is
 * most of what is here. A document whose every block is exactly what its type
 * calls for needs no translation layer worth testing.
 *
 * Built against a real `yorkie.Document`, and the malformed cases are written
 * straight into it — Yorkie validates nothing, which is the same reason the
 * app has to. Casts mark where a block is deliberately not what the schema
 * says: that is data from a client we do not control, which today is anything
 * on the LAN that can reach port 8080.
 */

let counter = 0;

/** Puts `blocks` into a real document and reads them back out. */
function read(blocks: Array<unknown>) {
  const doc = new yorkie.Document<BlockDocumentRoot>(`doc-test-${(counter += 1)}`);

  doc.update((root) => {
    root.blocks = blocks as Array<StoredBlock>;
  });

  return readBlocks(doc.getRoot().blocks);
}

/**
 * A block plus the text it should end up holding, kept apart because a
 * `yorkie.Text` can only be filled once it is inside a document.
 */
const withText = (id: string, type: string, text: string, rest = {}) => ({
  block: { id, type, content: { text: new yorkie.Text(), ...rest } },
  text,
});

function readWithText(specs: Array<ReturnType<typeof withText>>) {
  const doc = new yorkie.Document<BlockDocumentRoot>(`doc-test-${(counter += 1)}`);

  doc.update((root) => {
    root.blocks = specs.map((spec) => spec.block) as Array<StoredBlock>;
    for (const [index, spec] of specs.entries()) {
      if (spec.text) root.blocks[index]!.content!.text!.edit(0, 0, spec.text);
    }
  });

  return readBlocks(doc.getRoot().blocks);
}

describe("readBlocks", () => {
  it("reads an empty document as an empty list", () => {
    assert.deepEqual(read([]), []);
  });

  it("keeps the document's order", () => {
    const result = read([
      { id: "a", type: "text", content: {} },
      { id: "b", type: "text", content: {} },
      { id: "c", type: "text", content: {} },
    ]);

    assert.deepEqual(
      result.map((block) => block.id),
      ["a", "b", "c"],
    );
  });

  it("reads each text-bearing type with its own fields", () => {
    const result = readWithText([
      withText("t", "text", "본문"),
      withText("h", "heading", "제목", { level: 2 }),
      withText("l", "list", "항목", { style: "ordered", depth: 1 }),
      withText("c", "checklist", "할 일", { checked: true }),
      withText("q", "quote", "인용"),
      withText("k", "code", "코드"),
    ]);

    assert.deepEqual(result, [
      { id: "t", type: "text", text: "본문" },
      { id: "h", type: "heading", level: 2, text: "제목" },
      { id: "l", type: "list", style: "ordered", depth: 1, text: "항목" },
      { id: "c", type: "checklist", checked: true, text: "할 일" },
      { id: "q", type: "quote", text: "인용" },
      { id: "k", type: "code", text: "코드" },
    ]);
  });

  it("reads a divider, which carries nothing", () => {
    assert.deepEqual(read([{ id: "d", type: "divider" }]), [
      { id: "d", type: "divider" },
    ]);
  });
});

describe("readBlocks with fields a race left out", () => {
  it("falls back to the largest level for a heading that lost its own", () => {
    // Nothing in the CRDT ties `type` to `level`; they were separate writes.
    const [block] = readWithText([withText("h", "heading", "제목")]);

    assert.deepEqual(block, { id: "h", type: "heading", level: 1, text: "제목" });
  });

  it("falls back to an unordered list for a list that lost its style", () => {
    const [block] = readWithText([withText("l", "list", "항목")]);

    assert.deepEqual(block, {
      id: "l",
      type: "list",
      style: "unordered",
      depth: 0,
      text: "항목",
    });
  });

  it("reads a missing text as empty rather than failing", () => {
    const [block] = read([{ id: "t", type: "text", content: {} }]);

    assert.deepEqual(block, { id: "t", type: "text", text: "" });
  });

  it("reads a block with no content at all", () => {
    // The whole `content` object can be absent — every field on it is optional.
    const [block] = read([{ id: "h", type: "heading" }]);

    assert.deepEqual(block, { id: "h", type: "heading", level: 1, text: "" });
  });

  it("reads the file-backed types with blank references", () => {
    assert.deepEqual(
      read([
        { id: "f", type: "file", content: {} },
        { id: "i", type: "image", content: {} },
        { id: "p", type: "pdf", content: {} },
        { id: "dl", type: "doc-link", content: {} },
        { id: "bl", type: "block-link", content: {} },
      ]),
      [
        { id: "f", type: "file", fileId: "", fileName: "", fileType: "", size: 0 },
        { id: "i", type: "image", fileId: "", fileName: "", size: 0 },
        { id: "p", type: "pdf", fileId: "", fileName: "", size: 0 },
        { id: "dl", type: "doc-link", documentId: "" },
        { id: "bl", type: "block-link", documentId: "", blockId: "" },
      ],
    );
  });
});

describe("readBlocks with fields a race left behind", () => {
  it("ignores fields the current type does not own", () => {
    // This is the litter two simultaneous conversions produce, and the reason
    // leaving it alone is safe: every reader gates on `type`.
    const [block] = readWithText([
      withText("h", "heading", "제목", {
        level: 3,
        style: "ordered",
        depth: 5,
        checked: true,
      }),
    ]);

    assert.deepEqual(block, { id: "h", type: "heading", level: 3, text: "제목" });
  });

  it("reads a list that still carries a heading's level", () => {
    const [block] = readWithText([
      withText("l", "list", "항목", { style: "unordered", depth: 0, level: 2 }),
    ]);

    assert.deepEqual(block, {
      id: "l",
      type: "list",
      style: "unordered",
      depth: 0,
      text: "항목",
    });
  });
});

describe("readBlocks with values nothing validated", () => {
  it("clamps a negative depth to the top level", () => {
    // Yorkie takes whatever it is given, and a negative depth would indent
    // backwards out of the document.
    const [block] = readWithText([
      withText("l", "list", "항목", { style: "unordered", depth: -4 }),
    ]);

    assert.equal(block && "depth" in block ? block.depth : null, 0);
  });

  it("truncates a fractional depth", () => {
    const [block] = readWithText([
      withText("l", "list", "항목", { style: "unordered", depth: 2.9 }),
    ]);

    assert.equal(block && "depth" in block ? block.depth : null, 2);
  });

  it("treats anything but true as unchecked", () => {
    const result = readWithText([
      withText("a", "checklist", "", { checked: "true" }),
      withText("b", "checklist", "", { checked: 1 }),
      withText("c", "checklist", "", { checked: true }),
    ]);

    assert.deepEqual(
      result.map((block) => ("checked" in block ? block.checked : null)),
      [false, false, true],
    );
  });
});

describe("readBlocks with a type it does not know", () => {
  it("drops the block", () => {
    // It cannot be drawn — there is no renderer for a type this build has never
    // heard of — and guessing would misrepresent it.
    assert.deepEqual(read([{ id: "x", type: "sparkline", content: {} }]), []);
  });

  it("still reads every block around it", () => {
    // One block from a newer client must not cost the rest of the document.
    const result = read([
      { id: "a", type: "text", content: {} },
      { id: "x", type: "sparkline", content: {} },
      { id: "b", type: "text", content: {} },
    ]);

    assert.deepEqual(
      result.map((block) => block.id),
      ["a", "b"],
    );
  });
});
