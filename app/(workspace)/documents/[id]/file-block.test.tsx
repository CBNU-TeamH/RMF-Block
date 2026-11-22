// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type { FileBlock } from "@/lib/blocks/types";
import { FileBlockView } from "./file-block.tsx";

afterEach(cleanup);

const block = { id: "b1", type: "file", fileId: "f1", fileName: "budget.xlsx", fileType: "application/vnd.ms-excel", size: 2048 } as FileBlock;

describe("FileBlockView", () => {
  it("is a download card that says it has no preview (FR-080-05)", () => {
    render(<FileBlockView block={block} onDelete={() => {}} />);
    const card = screen.getByText("budget.xlsx").closest("a")!;

    assert.equal(card.getAttribute("href"), "/api/files/f1/download");
    assert.match(card.textContent!, /미리보기 불가 · 내려받기/);
  });
});
