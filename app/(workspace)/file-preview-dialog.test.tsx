// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { FilePreviewDialog } from "./file-preview-dialog.tsx";

const IMAGE = { fileId: "f1", fileName: "diagram.png", fileType: "image/png" };
const PDF = { fileId: "f2", fileName: "spec.pdf", fileType: "application/pdf" };

const dialog = () => screen.getByRole("dialog", { hidden: true }) as HTMLDialogElement;

afterEach(cleanup);

describe("FilePreviewDialog", () => {
  it("shows an image as an image, and a PDF in the browser's viewer", () => {
    const { rerender } = render(<FilePreviewDialog file={IMAGE} onClose={() => undefined} />);
    assert.equal(dialog().open, true);
    assert.equal(dialog().getAttribute("aria-label"), "diagram.png 미리보기");
    assert.equal(screen.getByRole("img", { name: "diagram.png", hidden: true }).getAttribute("src"), "/api/files/f1/preview");

    rerender(<FilePreviewDialog file={PDF} onClose={() => undefined} />);
    assert.equal(screen.getByTitle("spec.pdf").getAttribute("src"), "/api/files/f2/preview");
    assert.equal(
      screen.getByRole("link", { name: "내려받기", hidden: true }).getAttribute("href"),
      "/api/files/f2/download",
    );
  });

  it("asks to close from 닫기, the backdrop and Esc", () => {
    const onClose = vi.fn();
    render(<FilePreviewDialog file={IMAGE} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "닫기", hidden: true }));
    // A backdrop click lands on the dialog itself.
    fireEvent.click(dialog());
    // Esc ends in the dialog's own `close` event.
    fireEvent(dialog(), new Event("close"));

    assert.equal(onClose.mock.calls.length, 3);
  });

  it("closes and drops its content once no file is chosen", () => {
    const { rerender } = render(<FilePreviewDialog file={IMAGE} onClose={() => undefined} />);
    rerender(<FilePreviewDialog file={null} onClose={() => undefined} />);

    assert.equal(dialog().open, false);
    assert.equal(screen.queryByRole("img", { hidden: true }), null);
  });
});
