// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { FloatingFrame } from "./floating-frame.tsx";
import { WindowStackProvider } from "./window-stack.tsx";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const frame = { x: 0, y: 0, width: 300, height: 200 };

function Window({ name, onClose = () => undefined, children }: { name: string; onClose?: () => void; children?: React.ReactNode }) {
  return (
    <FloatingFrame
      layer={name}
      frame={frame}
      begin={() => () => undefined}
      resize="corner"
      label={name}
      title={name}
      closeLabel={`${name} 닫기`}
      onClose={onClose}
    >
      {children}
    </FloatingFrame>
  );
}

const zOf = (name: string) => Number(screen.getByRole("region", { name }).style.zIndex);

describe("FloatingFrame — in front (#144)", () => {
  it("puts a window that opens in front, and a pressed one in front of that", () => {
    render(
      <WindowStackProvider>
        <Window name="a" />
        <Window name="b" />
      </WindowStackProvider>,
    );
    assert.ok(zOf("b") > zOf("a"));

    fireEvent.pointerDown(screen.getByText("a"));

    assert.ok(zOf("a") > zOf("b"));
    // A press on the title bar, which keeps focus where it was, still focuses it.
    // Compared as a boolean: a failing diff of two DOM nodes exhausts the worker.
    assert.equal(document.activeElement === screen.getByRole("region", { name: "a" }), true);
  });

  it("raises a window focused from the keyboard", () => {
    render(
      <WindowStackProvider>
        <Window name="a">
          <button type="button">안</button>
        </Window>
        <Window name="b" />
      </WindowStackProvider>,
    );

    fireEvent.focus(screen.getByRole("button", { name: "안" }));

    assert.ok(zOf("a") > zOf("b"));
  });

  // What Chrome does for a press inside a PDF: no focus event on the page, only
  // its window blurring with the iframe active.
  it("raises a window whose PDF took the focus", () => {
    render(
      <WindowStackProvider>
        <Window name="a">
          <iframe title="PDF" />
        </Window>
        <Window name="b" />
      </WindowStackProvider>,
    );
    vi.spyOn(document, "activeElement", "get").mockReturnValue(screen.getByTitle("PDF"));

    act(() => {
      window.dispatchEvent(new Event("blur"));
    });

    assert.ok(zOf("a") > zOf("b"));
  });

  it("closes the gap a closed window leaves, staying under the menus' z-40", () => {
    const { rerender } = render(
      <WindowStackProvider>
        <Window name="a" />
        <Window name="b" />
        <Window name="c" />
      </WindowStackProvider>,
    );
    rerender(
      <WindowStackProvider>
        <Window name="a" />
        <Window name="c" />
      </WindowStackProvider>,
    );

    assert.equal(zOf("c") - zOf("a"), 1);
    assert.ok(zOf("c") < 40);
  });
});

describe("FloatingFrame — Escape (#144)", () => {
  const setup = (children?: React.ReactNode) => {
    const onClose = vi.fn();
    render(
      <Window name="a" onClose={onClose}>
        {children}
      </Window>,
    );
    return onClose;
  };

  it("closes the window it was pressed in", () => {
    const onClose = setup(<button type="button">안</button>);

    fireEvent.keyDown(screen.getByRole("button", { name: "안" }), { key: "Escape" });

    assert.equal(onClose.mock.calls.length, 1);
  });

  it("is left alone during a composition, inside a dialog, or once used inside", () => {
    const onClose = setup(
      <>
        <input aria-label="입력" />
        <dialog open>
          <button type="button">대화상자</button>
        </dialog>
        <input aria-label="초안" onKeyDown={(event) => event.preventDefault()} />
      </>,
    );

    fireEvent.keyDown(screen.getByRole("textbox", { name: "입력" }), { key: "Escape", isComposing: true });
    fireEvent.keyDown(screen.getByRole("button", { name: "대화상자" }), { key: "Escape" });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "초안" }), { key: "Escape" });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "입력" }), { key: "Enter" });

    assert.equal(onClose.mock.calls.length, 0);
  });
});
