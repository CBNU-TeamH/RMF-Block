// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { BlockLinkBlock } from "@/lib/blocks/types";

const goToBlock = vi.fn();
vi.mock("../../focus-follow-provider", () => ({ useFocusFollow: () => ({ goToBlock }) }));

import { BlockLinkBlockView } from "./block-link-block.tsx";

const block: BlockLinkBlock = { id: "l1", type: "block-link", documentId: "d1", blockId: "b9" };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  goToBlock.mockClear();
});

describe("BlockLinkBlockView", () => {
  it("names the document and jumps to the block on click", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ document: { name: "회의록" } }));
    render(<BlockLinkBlockView block={block} onDelete={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "회의록 › 블록" }));
    assert.deepEqual(goToBlock.mock.calls, [["d1", "b9"]]);
  });

  it("shows a deleted document as unavailable instead of a link", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 404 }));
    render(<BlockLinkBlockView block={block} onDelete={vi.fn()} />);

    await waitFor(() => assert.ok(screen.getByText("삭제된 문서의 블록입니다.")));
    assert.equal(screen.queryByRole("button", { name: /블록$/ }), null);
  });

  it("removes itself only after a confirmation", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ document: { name: "A" } }));
    const onDelete = vi.fn();
    render(<BlockLinkBlockView block={block} onDelete={onDelete} />);
    await screen.findByRole("button", { name: "A › 블록" });

    fireEvent.click(screen.getAllByRole("button", { name: "삭제" })[0]!);
    assert.equal(onDelete.mock.calls.length, 0);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    assert.deepEqual(onDelete.mock.calls, [["l1"]]);
  });
});
