import assert from "node:assert/strict";
import { describe, it } from "node:test";

import yorkie from "@yorkie-js/sdk";

import { createChecklist, createHeading, createList, createText } from "./create.ts";
import type { BlockDocumentRoot, StoredBlock } from "./document.ts";
import { readBlocks, toStoredBlock } from "./document.ts";
import {
  BlockNotFoundError,
  appendBlock,
  changeBlockType,
  editBlockText,
  insertBlockAfter,
  moveBlockAfter,
  removeBlock,
  type BlockArray,
} from "./operations.ts";

/**
 * Against a real `yorkie.Document`, not a stand-in.
 *
 * A document works fully without a client or a server — `update()`, the array
 * methods, and `Text.edit` all run locally — so there is nothing here a fake
 * would make easier, and a fake would only be able to disagree with the thing
 * it stands for. It also means these tests cover the parts of Yorkie's API that
 * type-check but do not exist: `unshift` passed `tsc` and threw at runtime.
 *
 * What this cannot cover is convergence, which needs two replicas and a server.
 * Those measurements live in `docs/design/document-editing.md`.
 */

let counter = 0;
const newDoc = () =>
  new yorkie.Document<BlockDocumentRoot>(`test-${(counter += 1)}`);

/** A stored block with its own `yorkie.Text`, ready to be inserted. */
const storedBlock = (id: string, type = "text"): StoredBlock =>
  ({ id, type, content: { text: new yorkie.Text() } }) as StoredBlock;

/** Seeds `ids` as text blocks, each holding its own id as its text. */
function seed(doc: ReturnType<typeof newDoc>, ids: Array<string>) {
  doc.update((root) => {
    root.blocks = [];
    for (const id of ids) {
      (root.blocks as BlockArray).push(storedBlock(id));
    }
    for (const [index, id] of ids.entries()) {
      root.blocks[index]!.content!.text!.edit(0, 0, id);
    }
  });
}

const idsOf = (doc: ReturnType<typeof newDoc>) =>
  doc.getRoot().blocks.map((block) => block.id);

const blocks = (root: BlockDocumentRoot) => root.blocks as BlockArray;

describe("insertBlockAfter", () => {
  it("inserts after the named block", () => {
    const doc = newDoc();
    seed(doc, ["a", "b", "c"]);

    doc.update((root) => insertBlockAfter(blocks(root), "a", storedBlock("x")));

    assert.deepEqual(idsOf(doc), ["a", "x", "b", "c"]);
  });

  it("inserts at the front when there is no block to follow", () => {
    // `unshift` type-checks and does not exist — this is the case that caught it.
    const doc = newDoc();
    seed(doc, ["a", "b"]);

    doc.update((root) => insertBlockAfter(blocks(root), null, storedBlock("x")));

    assert.deepEqual(idsOf(doc), ["x", "a", "b"]);
  });

  it("inserts into an empty document", () => {
    // There is no first element to insert before, so this takes another path.
    const doc = newDoc();
    seed(doc, []);

    doc.update((root) => insertBlockAfter(blocks(root), null, storedBlock("x")));

    assert.deepEqual(idsOf(doc), ["x"]);
  });

  it("refuses to insert after a block that is not there", () => {
    const doc = newDoc();
    seed(doc, ["a"]);

    assert.throws(
      () => doc.update((root) => insertBlockAfter(blocks(root), "nope", storedBlock("x"))),
      BlockNotFoundError,
    );
  });
});

describe("appendBlock", () => {
  it("adds to the end", () => {
    const doc = newDoc();
    seed(doc, ["a", "b"]);

    doc.update((root) => appendBlock(blocks(root), storedBlock("c")));

    assert.deepEqual(idsOf(doc), ["a", "b", "c"]);
  });
});

describe("removeBlock", () => {
  it("removes the named block and leaves the rest in order", () => {
    const doc = newDoc();
    seed(doc, ["a", "b", "c"]);

    doc.update((root) => removeBlock(blocks(root), "b"));

    assert.deepEqual(idsOf(doc), ["a", "c"]);
  });

  it("removes by id, not by position", () => {
    // The point of naming blocks by id: the same call has to hit "b" wherever
    // it has ended up.
    const doc = newDoc();
    seed(doc, ["a", "b", "c"]);
    doc.update((root) => moveBlockAfter(blocks(root), null, "b"));

    doc.update((root) => removeBlock(blocks(root), "b"));

    assert.deepEqual(idsOf(doc), ["a", "c"]);
  });

  it("refuses to remove a block that is not there", () => {
    const doc = newDoc();
    seed(doc, ["a"]);

    assert.throws(
      () => doc.update((root) => removeBlock(blocks(root), "nope")),
      BlockNotFoundError,
    );
  });
});

describe("moveBlockAfter", () => {
  it("moves a block after the named one", () => {
    const doc = newDoc();
    seed(doc, ["a", "b", "c"]);

    doc.update((root) => moveBlockAfter(blocks(root), "c", "a"));

    assert.deepEqual(idsOf(doc), ["b", "c", "a"]);
  });

  it("moves a block to the front", () => {
    const doc = newDoc();
    seed(doc, ["a", "b", "c"]);

    doc.update((root) => moveBlockAfter(blocks(root), null, "c"));

    assert.deepEqual(idsOf(doc), ["c", "a", "b"]);
  });

  it("leaves the order alone when the front block is moved to the front", () => {
    const doc = newDoc();
    seed(doc, ["a", "b", "c"]);

    doc.update((root) => moveBlockAfter(blocks(root), null, "a"));

    assert.deepEqual(idsOf(doc), ["a", "b", "c"]);
  });

  it("keeps the block's text through the move", () => {
    // A move rewrites the position and leaves the element — the `yorkie.Text`
    // inside it is the same CRDT afterwards, not a copy.
    const doc = newDoc();
    seed(doc, ["a", "b", "c"]);

    doc.update((root) => moveBlockAfter(blocks(root), "c", "a"));

    const moved = readBlocks(doc.getRoot().blocks).find((b) => b.id === "a");
    assert.equal(moved && "text" in moved ? moved.text : null, "a");
  });
});

describe("editBlockText", () => {
  it("inserts at an offset", () => {
    const doc = newDoc();
    seed(doc, ["a"]);

    doc.update((root) => editBlockText(blocks(root), "a", 1, 1, "bc"));

    assert.equal(doc.getRoot().blocks[0]!.content!.text!.toString(), "abc");
  });

  it("deletes a range with an empty value", () => {
    const doc = newDoc();
    seed(doc, ["abc"]);

    doc.update((root) => editBlockText(blocks(root), "abc", 1, 3, ""));

    assert.equal(doc.getRoot().blocks[0]!.content!.text!.toString(), "a");
  });

  it("replaces a range", () => {
    const doc = newDoc();
    seed(doc, ["abc"]);

    doc.update((root) => editBlockText(blocks(root), "abc", 1, 2, "XY"));

    assert.equal(doc.getRoot().blocks[0]!.content!.text!.toString(), "aXYc");
  });

  it("refuses a block that holds no text", () => {
    const doc = newDoc();
    doc.update((root) => {
      root.blocks = [];
      (root.blocks as BlockArray).push({ id: "d", type: "divider" });
    });

    assert.throws(() => doc.update((root) => editBlockText(blocks(root), "d", 0, 0, "x")));
  });
});

describe("toStoredBlock (#45)", () => {
  it("makes a create.ts factory's output immediately editable", () => {
    // The exact gap #45 reported: create.ts's factories return the view-model
    // `Block`, not the `StoredBlock` operations.ts expects, and nothing bridged
    // them — a block inserted straight from a factory had no `content.text` to
    // edit and `editBlockText` threw the moment anyone typed into it.
    const doc = newDoc();
    seed(doc, []);
    const created = createText();

    doc.update((root) => appendBlock(blocks(root), toStoredBlock(created)));
    doc.update((root) => editBlockText(blocks(root), created.id, 0, 0, "hello"));

    assert.equal(doc.getRoot().blocks[0]!.content!.text!.toString(), "hello");
  });

  it("carries a heading's level and a list's style/depth into content", () => {
    const doc = newDoc();
    seed(doc, []);
    const heading = createHeading(2);
    const list = createList("ordered", 1);

    doc.update((root) => {
      appendBlock(blocks(root), toStoredBlock(heading));
      appendBlock(blocks(root), toStoredBlock(list));
    });

    const [read1, read2] = readBlocks(doc.getRoot().blocks);
    assert.deepEqual(read1, { id: heading.id, type: "heading", level: 2, text: "" });
    assert.deepEqual(read2, {
      id: list.id,
      type: "list",
      style: "ordered",
      depth: 1,
      text: "",
    });
  });

  it("gives a checklist item its own text separately from another's", () => {
    // Each block's `new Text()` has to be its own CRDT instance, not one
    // shared reference — otherwise editing one would edit them all.
    const doc = newDoc();
    seed(doc, []);
    const a = createChecklist();
    const b = createChecklist();

    doc.update((root) => {
      appendBlock(blocks(root), toStoredBlock(a));
      appendBlock(blocks(root), toStoredBlock(b));
    });
    doc.update((root) => editBlockText(blocks(root), a.id, 0, 0, "wash dishes"));

    assert.equal(doc.getRoot().blocks[0]!.content!.text!.toString(), "wash dishes");
    assert.equal(doc.getRoot().blocks[1]!.content!.text!.toString(), "");
  });
});

describe("changeBlockType", () => {
  it("keeps the block's id and text", () => {
    // The whole reason this is a conversion and not a delete-and-create.
    const doc = newDoc();
    seed(doc, ["a"]);

    doc.update((root) =>
      changeBlockType(blocks(root), "a", { type: "list", style: "unordered" }),
    );

    const [block] = readBlocks(doc.getRoot().blocks);
    assert.equal(block?.id, "a");
    assert.equal(block?.type, "list");
    assert.equal(block && "text" in block ? block.text : null, "a");
  });

  it("takes on the new type's fields", () => {
    const doc = newDoc();
    seed(doc, ["a"]);

    doc.update((root) =>
      changeBlockType(blocks(root), "a", { type: "list", style: "ordered", depth: 2 }),
    );

    const content = doc.getRoot().blocks[0]!.content!;
    assert.equal(content.style, "ordered");
    assert.equal(content.depth, 2);
  });

  it("drops the fields the outgoing type owned", () => {
    // Left behind, they are the litter a racing pair of conversions produces.
    const doc = newDoc();
    seed(doc, ["a"]);
    doc.update((root) => changeBlockType(blocks(root), "a", { type: "heading", level: 2 }));

    doc.update((root) =>
      changeBlockType(blocks(root), "a", { type: "list", style: "unordered" }),
    );

    const content = doc.getRoot().blocks[0]!.content!;
    assert.equal(content.level, undefined);
    assert.equal(content.style, "unordered");
  });

  it("clears up litter a conversion race left behind", () => {
    // A block wearing every field at once — what two simultaneous conversions
    // can produce — is tidied by the next conversion through it.
    const doc = newDoc();
    seed(doc, ["a"]);
    doc.update((root) => {
      const content = root.blocks[0]!.content!;
      content.level = 1;
      content.style = "ordered";
      content.depth = 3;
      content.checked = true;
    });

    doc.update((root) => changeBlockType(blocks(root), "a", { type: "text" }));

    const content = doc.getRoot().blocks[0]!.content!;
    assert.deepEqual(
      Object.keys(content).filter((key) => key !== "text"),
      [],
    );
  });

  it("defaults a list's depth to the top level", () => {
    const doc = newDoc();
    seed(doc, ["a"]);

    doc.update((root) =>
      changeBlockType(blocks(root), "a", { type: "list", style: "unordered" }),
    );

    assert.equal(doc.getRoot().blocks[0]!.content!.depth, 0);
  });

  it("refuses a negative or fractional depth", () => {
    const doc = newDoc();
    seed(doc, ["a"]);

    doc.update((root) =>
      changeBlockType(blocks(root), "a", { type: "list", style: "unordered", depth: -3 }),
    );
    assert.equal(doc.getRoot().blocks[0]!.content!.depth, 0);

    doc.update((root) =>
      changeBlockType(blocks(root), "a", { type: "list", style: "unordered", depth: 1.7 }),
    );
    assert.equal(doc.getRoot().blocks[0]!.content!.depth, 1);
  });

  it("starts a checklist item unchecked", () => {
    const doc = newDoc();
    seed(doc, ["a"]);

    doc.update((root) => changeBlockType(blocks(root), "a", { type: "checklist" }));

    assert.equal(doc.getRoot().blocks[0]!.content!.checked, false);
  });
});

describe("several operations in one update", () => {
  it("splits a block into two", () => {
    // The case the API shape exists for: a split is one text edit plus one
    // insert plus another text edit, and a half-applied split is a worse
    // document than an unsplit one.
    const doc = newDoc();
    seed(doc, ["a"]);
    doc.update((root) => editBlockText(blocks(root), "a", 1, 1, "-tail"));

    doc.update((root) => {
      const array = blocks(root);
      const tail = root.blocks[0]!.content!.text!.toString().slice(1);
      editBlockText(array, "a", 1, 1 + tail.length, "");
      insertBlockAfter(array, "a", storedBlock("a2"));
      editBlockText(array, "a2", 0, 0, tail);
    });

    assert.deepEqual(idsOf(doc), ["a", "a2"]);
    assert.equal(doc.getRoot().blocks[0]!.content!.text!.toString(), "a");
    assert.equal(doc.getRoot().blocks[1]!.content!.text!.toString(), "-tail");
  });
});
