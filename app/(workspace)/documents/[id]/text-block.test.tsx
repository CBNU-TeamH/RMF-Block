// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
  const onPasteBlocks = vi.fn();
  const onSelectAllBlocks = vi.fn();
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
      onPasteBlocks={onPasteBlocks}
      onSelectAllBlocks={onSelectAllBlocks}
      onHistory={vi.fn()}
    />,
  );

  const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
  return { textarea, onSplit, onPasteBlocks, onSelectAllBlocks, remote: (patch: TextPatch) => handler(patch) };
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

  it("stays closed after Escape while the query goes on, and opens on a fresh / (#148)", () => {
    const { textarea } = renderBlock();
    fireEvent.input(textarea, { target: { value: "/" } });
    fireEvent.keyDown(textarea, { key: "Escape" });

    fireEvent.input(textarea, { target: { value: "/usr" } });
    assert.deepEqual(menuLabels(), []);
    assert.equal(screen.queryByRole("status"), null);

    fireEvent.input(textarea, { target: { value: "" } });
    fireEvent.input(textarea, { target: { value: "/" } });
    assert.ok(menuLabels().length > 0);
  });

  it("opens on a fresh / after a peer's edit removed the dismissed query (#148)", () => {
    const { textarea, remote } = renderBlock();
    fireEvent.input(textarea, { target: { value: "/t" } });
    fireEvent.keyDown(textarea, { key: "Escape" });

    act(() => remote({ from: 0, to: 1, value: { content: "" } }));
    assert.equal(textarea.value, "t");

    fireEvent.input(textarea, { target: { value: "/t" } });
    assert.ok(menuLabels().length > 0);
  });

  it("opens again after Escape once the block has lost focus (#148)", () => {
    const { textarea } = renderBlock();
    fireEvent.input(textarea, { target: { value: "/" } });
    fireEvent.keyDown(textarea, { key: "Escape" });
    fireEvent.blur(textarea);
    fireEvent.focus(textarea);

    fireEvent.input(textarea, { target: { value: "/t" } });
    assert.ok(menuLabels().length > 0);
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

    textarea.setSelectionRange(3, 3);
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

    textarea.setSelectionRange(2, 2);
    fireEvent.compositionStart(textarea);
    fireEvent.input(textarea, { target: { value: "ab안cd" } });
    remote(peer(1, 3, "")); // "bc", on both sides of the composition point
    fireEvent.compositionEnd(textarea);

    assert.equal(live(), "a안d");
    assert.equal(textarea.value, live());
  });

  it("keeps a composition where it started inside a run of the same character", () => {
    // A diff of 가가b → 가가가b cannot say which 가 is new; the caret can.
    const { doc, peer, live } = seeded("가가b");
    const { textarea, remote } = renderBlock({ type: "text" }, doc, "가가b");

    textarea.setSelectionRange(1, 1);
    fireEvent.compositionStart(textarea);
    fireEvent.input(textarea, { target: { value: "가가가b" } });
    remote(peer(1, 2, "X")); // the second of the original two 가
    fireEvent.compositionEnd(textarea);

    assert.equal(live(), "가가Xb");
    assert.equal(textarea.value, live());
  });
});

describe("pasting a block address", () => {
  const address = "http://192.168.0.2:3000/documents/d1#block=b9";
  const paste = (textarea: HTMLTextAreaElement, text: string) =>
    fireEvent.paste(textarea, { clipboardData: { getData: () => text } });

  it("is handed to the editor when the block is empty", () => {
    const { textarea, onPasteBlocks } = renderBlock();
    paste(textarea, address);
    assert.deepEqual(onPasteBlocks.mock.calls, [["b1", address]]);
  });

  it("stays an ordinary paste in a block that already has text", () => {
    const { textarea, onPasteBlocks } = renderBlock({ type: "text" }, null, "memo ");
    paste(textarea, address);
    assert.equal(onPasteBlocks.mock.calls.length, 0);
  });

  it("stays an ordinary paste for a document address with no block", () => {
    const { textarea, onPasteBlocks } = renderBlock();
    paste(textarea, "http://192.168.0.2:3000/documents/d1");
    assert.equal(onPasteBlocks.mock.calls.length, 0);
  });
});

describe("inline formatting", () => {
  // The overlay's, not the print copy's, which draws the same text at all times.
  const drawn = (tag: string) =>
    [...document.querySelectorAll(tag)].find((element) => !element.closest("[data-print-copy]")) ?? null;
  const strong = () => drawn("strong")?.textContent ?? null;

  it("keeps a print copy of the text, current even while the block has focus", () => {
    const { textarea } = renderBlock({ type: "text" }, null, "**a** b");
    const copy = () => document.querySelector("[data-print-copy]");
    assert.equal(copy()?.querySelector("strong")?.textContent, "a");

    fireEvent.focus(textarea);
    fireEvent.change(textarea, { target: { value: "**a** b 추가" } });
    act(() => {
      window.dispatchEvent(new Event("beforeprint"));
    });
    assert.equal(copy()?.textContent, "a b 추가");
  });

  it("prints text with no marks as typed, backslashes included", () => {
    renderBlock({ type: "text" }, null, "\\\\server\\share");
    assert.equal(document.querySelector("[data-print-copy]")?.textContent, "\\\\server\\share");
  });

  it("draws inline Markdown while the block is not being edited, and shows the markers while it is", () => {
    const { textarea } = renderBlock({ type: "text" }, null, "**a** b");
    assert.equal(strong(), "a");
    assert.equal(textarea.style.color, "transparent");

    fireEvent.focus(textarea);
    assert.equal(strong(), null);
    assert.equal(textarea.style.color, "");

    fireEvent.blur(textarea);
    assert.equal(strong(), "a");
  });

  it("redraws after a peer's edit", () => {
    const { remote } = renderBlock({ type: "text" }, null, "plain");
    assert.equal(drawn("em"), null);
    act(() => remote({ from: 0, to: 0, value: { content: "*x* " } }));
    assert.equal(drawn("em")?.textContent, "x");
  });

  it("leaves a code block as typed", () => {
    renderBlock({ type: "code" }, null, "**a**");
    assert.equal(strong(), null);
  });

  it("wraps the selection on Ctrl/Cmd+B, I and U, and unwraps it on a second press", () => {
    const { textarea } = renderBlock({ type: "text" }, null, "ab cd");
    textarea.setSelectionRange(3, 5);
    assert.equal(fireEvent.keyDown(textarea, { key: "b", ctrlKey: true }), false);
    assert.equal(textarea.value, "ab **cd**");
    assert.deepEqual([textarea.selectionStart, textarea.selectionEnd], [5, 7]);

    fireEvent.keyDown(textarea, { key: "b", metaKey: true });
    assert.equal(textarea.value, "ab cd");

    fireEvent.keyDown(textarea, { key: "u", ctrlKey: true });
    assert.equal(textarea.value, "ab <u>cd</u>");
  });
});

describe("Ctrl/Cmd+A", () => {
  it("selects the block's own text first, and every block once that is all selected", () => {
    const { textarea, onSelectAllBlocks } = renderBlock({ type: "text" }, null, "abc");
    textarea.setSelectionRange(0, 1);
    assert.equal(fireEvent.keyDown(textarea, { key: "a", ctrlKey: true }), true);
    assert.equal(onSelectAllBlocks.mock.calls.length, 0);

    textarea.setSelectionRange(0, 3);
    assert.equal(fireEvent.keyDown(textarea, { key: "a", metaKey: true }), false);
    assert.equal(onSelectAllBlocks.mock.calls.length, 1);
  });

  it("selects every block at once from an empty block", () => {
    const { textarea, onSelectAllBlocks } = renderBlock();
    fireEvent.keyDown(textarea, { key: "a", ctrlKey: true });
    assert.equal(onSelectAllBlocks.mock.calls.length, 1);
  });
});
