// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import yorkie, { type Document } from "@yorkie-js/sdk";

import type { BlockDocumentRoot, StoredBlock } from "@/lib/blocks/document";
import { editBlockText, type BlockArray } from "@/lib/blocks/operations";
import type { TextPatch } from "@/lib/blocks/text-surface";
import { TextBlockView, type BlockVariant } from "./text-block.tsx";

afterEach(cleanup);

/** With no document attached `commitLocal` returns before touching Yorkie,
 *  which is all the `/` menu tests need. `remote` plays the editor's
 *  subscription, handing this block a patch the way a peer's edit arrives. */
function renderBlock(
  variant: BlockVariant = { type: "text" },
  doc: Document<BlockDocumentRoot> | null = null,
  initialText = "",
) {
  const onSplit = vi.fn();
  let handler: (patch: TextPatch) => void = () => {};
  render(
    <TextBlockView
      blockId="b1"
      initialText={initialText}
      variant={variant}
      docRef={{ current: doc }}
      registerRemoteHandler={(_id, h) => {
        handler = h;
        return () => {};
      }}
      registerTextarea={() => {}}
      onMarkdownShortcut={vi.fn()}
      onSplit={onSplit}
      onMergeWithPrevious={vi.fn()}
      onNavigateUp={vi.fn()}
      onNavigateDown={vi.fn()}
      onTextCommitted={vi.fn()}
      onSlashSelect={vi.fn()}
      onFocusBlock={vi.fn()}
      onIndent={vi.fn()}
      onPasteBlocks={vi.fn()}
      onHistory={vi.fn()}
    />,
  );

  const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
  return { textarea, onSplit, remote: (patch: TextPatch) => handler(patch) };
}

function menuLabels(): Array<string> {
  const menu = screen.queryByRole("listbox", { name: "블록 종류" });
  if (!menu) return [];
  return within(menu)
    .getAllByRole("option")
    .map((option) => option.firstElementChild?.textContent ?? "");
}

describe("TextBlockView's / menu", () => {
  it("filters on a query that arrived through an IME composition (#103)", () => {
    const { textarea } = renderBlock();
    fireEvent.input(textarea, { target: { value: "/" } });
    assert.ok(menuLabels().length > 1);

    // Every input event inside a composition is skipped on purpose, so only
    // `compositionend` can tell the menu what was typed.
    fireEvent.compositionStart(textarea);
    fireEvent.input(textarea, { target: { value: "/페이지" } });
    fireEvent.compositionEnd(textarea);

    assert.deepEqual(menuLabels(), ["페이지"]);
  });

  it("narrows while a syllable is still being composed", () => {
    const { textarea } = renderBlock();
    fireEvent.compositionStart(textarea);
    fireEvent.input(textarea, { target: { value: "/제" } });

    assert.deepEqual(menuLabels(), ["제목 1", "제목 2", "제목 3"]);
  });

  it("opens in a heading, so the heading can become text again (#145)", () => {
    const { textarea } = renderBlock({ type: "heading", level: 2 });
    fireEvent.input(textarea, { target: { value: "/텍스트" } });

    assert.deepEqual(menuLabels(), ["텍스트"]);
  });

  it("says so when nothing matches, without taking Enter away (#145)", () => {
    const { textarea, onSplit } = renderBlock();
    fireEvent.input(textarea, { target: { value: "/zzzz" } });

    assert.equal(screen.getByRole("status").textContent, "결과 없음");
    fireEvent.keyDown(textarea, { key: "Enter" });
    assert.equal(onSplit.mock.calls.length, 1);

    fireEvent.keyDown(textarea, { key: "Escape" });
    assert.equal(screen.queryByRole("status"), null);
  });

  it("leaves Escape to an open IME composition", () => {
    const { textarea } = renderBlock();
    fireEvent.input(textarea, { target: { value: "/" } });
    fireEvent.compositionStart(textarea);
    fireEvent.keyDown(textarea, { key: "Escape" });

    assert.ok(menuLabels().length > 0);
  });

  it("closes when the block loses focus", () => {
    const { textarea } = renderBlock();
    fireEvent.input(textarea, { target: { value: "/zzzz" } });
    fireEvent.blur(textarea);

    assert.equal(screen.queryByRole("status"), null);
  });

  it("stays shut in a code block, where / is source text", () => {
    const { textarea } = renderBlock({ type: "code" });
    fireEvent.input(textarea, { target: { value: "/" } });

    assert.equal(screen.queryByRole("listbox"), null);
  });
});

describe("TextBlockView's remote edits", () => {
  /** A real, never-attached document holding one text block. `peer` makes the
   *  edit a peer would — in Yorkie first, then the patch the block receives. */
  function seeded(text = "abc") {
    const doc = new yorkie.Document<BlockDocumentRoot>("text-block");
    doc.update((root) => {
      root.blocks = [{ id: "b1", type: "text", content: { text: new yorkie.Text() } } as StoredBlock];
      root.blocks[0]!.content!.text!.edit(0, 0, text);
    });
    const peer = (from: number, to: number, content: string): TextPatch => {
      doc.update((root) => editBlockText(root.blocks as BlockArray, "b1", from, to, content));
      return { from, to, value: { content } };
    };
    const live = () => doc.getRoot().blocks[0]!.content!.text!.toString();
    return { doc, peer, live };
  }

  it("patches the textarea and keeps the caret on its character", () => {
    const { doc, peer } = seeded();
    const { textarea, remote } = renderBlock({ type: "text" }, doc, "abc");
    textarea.setSelectionRange(3, 3);

    remote(peer(0, 0, "X"));

    assert.equal(textarea.value, "Xabc");
    assert.equal(textarea.selectionStart, 4);
  });

  it("ends equal to Yorkie when edits land on both sides of an open composition (#52)", () => {
    const { doc, peer, live } = seeded();
    const { textarea, remote } = renderBlock({ type: "text" }, doc, "abc");

    fireEvent.compositionStart(textarea);
    fireEvent.input(textarea, { target: { value: "abc안" } });
    // Yorkie's offsets: X before the composition point, Z at Yorkie's end —
    // which is after it on screen.
    remote(peer(0, 0, "X"));
    remote(peer(4, 4, "Z"));
    fireEvent.compositionEnd(textarea);

    assert.equal(live(), "Xabc안Z");
    assert.equal(textarea.value, live());
  });

  it("keeps the composed text when a peer deletes across it", () => {
    const { doc, peer, live } = seeded("abcd");
    const { textarea, remote } = renderBlock({ type: "text" }, doc, "abcd");

    fireEvent.compositionStart(textarea);
    fireEvent.input(textarea, { target: { value: "ab안cd" } });
    remote(peer(1, 3, "")); // "bc", on both sides of the composition point
    fireEvent.compositionEnd(textarea);

    assert.equal(live(), "a안d");
    assert.equal(textarea.value, live());
  });
});
