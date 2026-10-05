// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { TextBlockView, type BlockVariant } from "./text-block.tsx";

afterEach(cleanup);

/** No document attached: `commitLocal` returns before touching Yorkie, which
 *  leaves only what these tests are about — the `/` menu's query. */
function renderBlock(variant: BlockVariant = { type: "text" }) {
  const onSplit = vi.fn();
  render(
    <TextBlockView
      blockId="b1"
      initialText=""
      variant={variant}
      docRef={{ current: null }}
      registerRemoteHandler={() => () => {}}
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

  return { textarea: screen.getByRole("textbox"), onSplit };
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

  it("opens in a heading, so the heading can become text again (#145)", () => {
    const { textarea } = renderBlock({ type: "heading", level: 2 });
    fireEvent.input(textarea, { target: { value: "/텍스트" } });

    assert.deepEqual(menuLabels(), ["텍스트"]);
  });

  it("stays shut in a code block, where / is source text", () => {
    const { textarea } = renderBlock({ type: "code" });
    fireEvent.input(textarea, { target: { value: "/" } });

    assert.equal(screen.queryByRole("listbox"), null);
  });
});
