import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createChecklist,
  createCode,
  createDivider,
  createHeading,
  createList,
  createQuote,
  createText,
  newBlockId,
} from "./create.ts";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newBlockId", () => {
  it("produces a version 4 uuid", () => {
    assert.match(newBlockId(), UUID_V4);
  });

  it("does not repeat itself", () => {
    const ids = new Set(Array.from({ length: 1000 }, newBlockId));

    assert.equal(ids.size, 1000);
  });

  it("never calls crypto.randomUUID", () => {
    // The reason this matters is specific to this project: `randomUUID` is a
    // secure-context API, and guests reach the workspace over plain HTTP at
    // `http://<LAN-IP>:3000`. Only the host, on localhost, would find it
    // defined — so a dependency on it works in every test and on the host's
    // own browser, and fails for every guest. Pinned here rather than
    // discovered on a second device.
    const real = globalThis.crypto.randomUUID;
    globalThis.crypto.randomUUID = () => {
      throw new Error("randomUUID is unavailable outside a secure context");
    };

    try {
      assert.match(newBlockId(), UUID_V4);
    } finally {
      globalThis.crypto.randomUUID = real;
    }
  });
});

describe("block factories", () => {
  it("gives every block its own id", () => {
    const ids = [
      createText(),
      createText(),
      createHeading(1),
      createList("ordered"),
      createChecklist(),
      createQuote(),
      createCode(),
      createDivider(),
    ].map((block) => block.id);

    assert.equal(new Set(ids).size, ids.length);
  });

  it("starts every text-bearing block empty", () => {
    // Not an oversight to fill in later: text goes in through Yorkie's own
    // edit API, never as a value handed to a factory. See `create.ts`.
    assert.equal(createText().text, "");
    assert.equal(createHeading(1).text, "");
    assert.equal(createList("ordered").text, "");
    assert.equal(createChecklist().text, "");
    assert.equal(createQuote().text, "");
    assert.equal(createCode().text, "");
  });

  it("creates a text block", () => {
    assert.equal(createText().type, "text");
  });

  it("creates a heading at the level it was asked for", () => {
    assert.equal(createHeading(1).level, 1);
    assert.equal(createHeading(2).level, 2);
    assert.equal(createHeading(3).level, 3);
    assert.equal(createHeading(2).type, "heading");
  });

  it("creates a list of the style it was asked for", () => {
    assert.equal(createList("ordered").style, "ordered");
    assert.equal(createList("unordered").style, "unordered");
    assert.equal(createList("ordered").type, "list");
  });

  it("starts a list at the top level unless told otherwise", () => {
    // The editor is what knows better — pressing Enter inside a nested item
    // should continue at that item's depth, and that is the caller's business.
    assert.equal(createList("unordered").depth, 0);
    assert.equal(createList("unordered", 2).depth, 2);
  });

  it("creates a checklist item that is not yet done", () => {
    assert.equal(createChecklist().checked, false);
    assert.equal(createChecklist().type, "checklist");
  });

  it("creates a quote block", () => {
    assert.equal(createQuote().type, "quote");
  });

  it("creates a code block", () => {
    assert.equal(createCode().type, "code");
  });

  it("creates a divider that carries nothing but its identity", () => {
    const divider = createDivider();

    assert.equal(divider.type, "divider");
    assert.deepEqual(Object.keys(divider).sort(), ["id", "type"]);
  });
});
