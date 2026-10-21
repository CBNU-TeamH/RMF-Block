// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";

vi.mock("./presence-provider.tsx", () => ({ useWorkspacePresence: () => ({ client: null }) }));

import { FloatingViewProvider, useFloatingViews } from "./floating-views.tsx";

class QuietSocket {
  addEventListener() {}
  close() {}
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

/** Opens a view of the next chat image on each press — files need no Yorkie client. */
function Opener({ again = false }: { again?: boolean }) {
  const open = useFloatingViews();
  const next = useRef(0);
  return (
    <button
      type="button"
      onClick={() => {
        const i = again ? 0 : next.current++;
        open({ fileId: `f-${i}`, fileName: `사진 ${i}.png`, fileType: "image/png", size: 1 });
      }}
    >
      열기
    </button>
  );
}

const setup = (opener: React.ReactNode) => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ documents: [] })));
  vi.stubGlobal("WebSocket", QuietSocket);
  render(
    <FloatingViewProvider colorTag="#000" nickname="지은">
      {opener}
    </FloatingViewProvider>,
  );
  return screen.getByRole("button", { name: "열기" });
};

const views = () => screen.queryAllByRole("region", { name: /^플로팅 뷰:/ });

describe("FloatingViewProvider — the cap (#144)", () => {
  it("refuses a sixth view and says so, leaving the five", () => {
    const button = setup(<Opener />);
    for (let i = 0; i < 5; i++) fireEvent.click(button);
    assert.equal(views().length, 5);
    assert.equal(screen.queryByRole("status"), null);

    fireEvent.click(button);

    assert.equal(views().length, 5);
    assert.equal(screen.getByRole("status").textContent, "플로팅 뷰는 최대 5개까지 열 수 있습니다.");
  });

  it("says nothing for a view already open", () => {
    const button = setup(<Opener again />);
    fireEvent.click(button);
    fireEvent.click(button);

    assert.equal(views().length, 1);
    assert.equal(screen.queryByRole("status"), null);
  });
});
