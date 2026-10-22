// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";

vi.mock("./presence-provider.tsx", () => ({ useWorkspacePresence: () => ({ client: null }) }));

import { FloatingViewProvider, useFloatingViews } from "./floating-views.tsx";
import { MAIN_ID } from "./ui.tsx";

class QuietSocket {
  addEventListener() {}
  close() {}
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  document.getElementById(MAIN_ID)?.remove();
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

  it("opens a view just inside the main area's top-left (#224)", () => {
    const main = document.createElement("main");
    main.id = MAIN_ID;
    main.getBoundingClientRect = () => ({ left: 260, top: 90 }) as DOMRect;
    document.body.append(main);
    const button = setup(<Opener />);

    fireEvent.click(button);

    const [view] = views();
    assert.deepEqual([view.style.left, view.style.top], ["284px", "114px"]);
  });

  it("says nothing for a view already open", () => {
    const button = setup(<Opener again />);
    fireEvent.click(button);
    fireEvent.click(button);

    assert.equal(views().length, 1);
    assert.equal(screen.queryByRole("status"), null);
  });
});

describe("FloatingViewProvider — a saved view's document (#187)", () => {
  const frame = { x: 300, y: 120, width: 200, height: 120 };
  /** A block view saved before the reload, and the catalogue that reload gets. */
  const restore = (catalogue: Response) => {
    window.localStorage.setItem("rmf-floating-views", JSON.stringify([{ documentId: "doc-1", blockId: "b-1", frame }]));
    vi.stubGlobal("fetch", vi.fn(async () => catalogue));
    vi.stubGlobal("WebSocket", QuietSocket);
    render(
      <FloatingViewProvider colorTag="#000" nickname="지은">
        {null}
      </FloatingViewProvider>,
    );
  };
  const document = (id: string, name: string) => ({ id, name, createdBy: "지은", createdAt: "", updatedAt: "" });

  it("is deleted once the catalogue has loaded without it", async () => {
    restore(Response.json({ documents: [document("doc-2", "남은 문서")] }));

    assert.ok(await screen.findByText("원본 문서가 삭제되었습니다."));
    assert.ok(screen.getByRole("region", { name: "플로팅 뷰: 삭제된 문서" }));
  });

  it("keeps its name while the catalogue has it", async () => {
    restore(Response.json({ documents: [document("doc-1", "회의록")] }));

    assert.ok(await screen.findByRole("region", { name: "플로팅 뷰: 회의록" }));
    assert.equal(screen.queryByText("원본 문서가 삭제되었습니다."), null);
  });

  it("is not taken for deleted when the catalogue never arrives", async () => {
    restore(new Response("nope", { status: 500 }));

    assert.ok(await screen.findByRole("region", { name: "플로팅 뷰: …" }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(screen.queryByText("원본 문서가 삭제되었습니다."), null);
  });
});
