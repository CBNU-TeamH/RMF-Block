// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const goToBlock = vi.fn();
const push = vi.fn();
vi.mock("./presence-provider.tsx", () => ({ useWorkspacePresence: () => ({ members: [] }) }));
vi.mock("./floating-views.tsx", () => ({ useFloatingViews: () => vi.fn() }));
vi.mock("./focus-follow-provider.tsx", () => ({ useFocusFollow: () => ({ goToBlock }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { ChatPanel } from "./chat-panel.tsx";

class QuietSocket {
  addEventListener() {}
  close() {}
}

/** Opens at once, which is what makes the panel fetch its history. */
class OpeningSocket {
  addEventListener(type: string, listener: () => void) {
    if (type === "open") queueMicrotask(listener);
  }
  close() {}
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const DOCUMENTS = [{ id: "doc-1", name: "회의록" }];
/** The props the window passes besides the ones a test is about. */
const shell = { documents: DOCUMENTS, link: null, onLink: () => undefined };

describe("ChatPanel", () => {
  // A guest opens http://<LAN-IP>:3000, which is not a secure context, so the
  // browser has no crypto.randomUUID there. Every send used to throw before the POST.
  it("sends a message where crypto.randomUUID does not exist", async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
      Response.json(
        init?.method === "POST"
          ? { id: "m1", sender: "지은", text: "안녕", sentAt: "2026-10-16T00:00:00.000Z" }
          : [],
      ),
    );
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("WebSocket", QuietSocket);
    vi.stubGlobal("crypto", { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });

    const user = userEvent.setup();
    render(<ChatPanel me="지은" {...shell} />);
    await user.type(screen.getByRole("textbox", { name: "채팅 메시지" }), "안녕{Enter}");

    await waitFor(() =>
      assert.ok(fetch.mock.calls.some(([url, init]) => url === "/api/chat" && init?.method === "POST")),
    );
  });

  // UC-050 E3-3: the file manager opens the window at a message.
  it("lands on a message from the history, out of the file list, and highlights it", async () => {
    const history = [
      { id: "m1", sender: "지은", text: "첫 메시지", sentAt: "2026-10-15T00:00:00.000Z" },
      { id: "m2", sender: "민수", text: "", sentAt: "2026-10-15T01:00:00.000Z", attachment: { fileId: "f", fileName: "photo.jpg", fileType: "image/jpeg", size: 3 } },
    ];
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(history)));
    vi.stubGlobal("WebSocket", OpeningSocket);
    const flashed: Array<string | undefined> = [];
    const original = HTMLElement.prototype.animate;
    HTMLElement.prototype.animate = function (this: HTMLElement) {
      flashed.push(this.dataset.messageId);
      return {} as Animation;
    };
    try {
      const onLanded = vi.fn();
      const { rerender } = render(<ChatPanel me="지은" {...shell} landOn={null} onLanded={onLanded} />);
      fireEvent.click(screen.getByRole("button", { name: "파일" }));

      rerender(<ChatPanel me="지은" {...shell} landOn="m2" onLanded={onLanded} />);

      await waitFor(() => assert.equal(onLanded.mock.calls.length, 1));
      assert.equal(screen.getByRole("button", { name: "대화" }).getAttribute("aria-pressed"), "true");
      assert.deepEqual(flashed, ["m2"]);
    } finally {
      HTMLElement.prototype.animate = original;
    }
  });
});

describe("ChatPanel — links (FR-060-01/03/06)", () => {
  const history = [
    { id: "m1", sender: "민수", text: "참고 https://example.com/a. 끝", sentAt: "2026-10-19T00:00:00.000Z" },
    {
      id: "m2",
      sender: "민수",
      text: "",
      link: { documentId: "doc-1", blockId: "b-1", documentName: "옛 이름", excerpt: "배포 일정" },
      sentAt: "2026-10-19T01:00:00.000Z",
    },
    { id: "m3", sender: "민수", text: "", link: { documentId: "gone", documentName: "지운 문서" }, sentAt: "2026-10-19T02:00:00.000Z" },
  ];
  const loaded = async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(history)));
    vi.stubGlobal("WebSocket", OpeningSocket);
    render(<ChatPanel me="지은" {...shell} />);
    await screen.findByText("배포 일정");
  };

  it("opens a URL in a new tab and leaves the punctuation after it", async () => {
    await loaded();

    const anchor = screen.getByRole("link", { name: "https://example.com/a" });
    assert.equal(anchor.getAttribute("target"), "_blank");
    assert.equal(anchor.getAttribute("rel"), "noopener noreferrer");
  });

  it("names a link's document as it is now, and lands on its block", async () => {
    await loaded();

    fireEvent.click(screen.getByRole("button", { name: /회의록\s*배포 일정/ }));

    assert.deepEqual(goToBlock.mock.calls, [["doc-1", "b-1"]]);
  });

  it("shows a deleted document's link by the name it was sent with, dimmed and inert", async () => {
    await loaded();

    const card = screen.getByRole("button", { name: /지운 문서\s*삭제된 문서/ });
    assert.equal((card as HTMLButtonElement).disabled, true);
  });

  it("attaches a pasted address of this workspace's document as a link, and types any other", () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([])));
    vi.stubGlobal("WebSocket", QuietSocket);
    const onLink = vi.fn();
    render(<ChatPanel me="지은" {...shell} onLink={onLink} />);
    const box = screen.getByRole("textbox", { name: "채팅 메시지" });
    const paste = (text: string) =>
      fireEvent.paste(box, { clipboardData: { files: [], getData: () => text } });

    paste("http://192.168.0.14:3000/documents/doc-1#block=b-1");
    paste("http://192.168.0.14:3000/documents/unknown");

    assert.deepEqual(onLink.mock.calls, [[{ documentId: "doc-1", blockId: "b-1" }]]);
  });

  it("picks a document to link from the input", () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([])));
    vi.stubGlobal("WebSocket", QuietSocket);
    const onLink = vi.fn();
    render(<ChatPanel me="지은" {...shell} onLink={onLink} />);

    fireEvent.click(screen.getByRole("button", { name: "문서 링크 첨부" }));
    fireEvent.click(screen.getByRole("button", { name: "회의록" }));

    assert.deepEqual(onLink.mock.calls, [[{ documentId: "doc-1" }]]);
  });

  it("sends the attached link, alone, and lets it go", async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
      Response.json(init?.method === "POST" ? { id: "m9", sender: "지은", text: "", sentAt: "2026-10-19T03:00:00.000Z" } : []),
    );
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("WebSocket", QuietSocket);
    const onLink = vi.fn();
    render(<ChatPanel me="지은" {...shell} link={{ documentId: "doc-1", blockId: "b-1", excerpt: "배포 일정" }} onLink={onLink} />);

    assert.ok(screen.getByText("회의록 › 배포 일정"));
    fireEvent.click(screen.getByRole("button", { name: "전송" }));

    await waitFor(() => assert.ok(fetch.mock.calls.some(([, init]) => init?.method === "POST")));
    const [, init] = fetch.mock.calls.find(([, init]) => init?.method === "POST")!;
    assert.deepEqual(JSON.parse(String(init?.body)).link, { documentId: "doc-1", blockId: "b-1", excerpt: "배포 일정" });
    assert.deepEqual(onLink.mock.calls, [[null]]);
  });
});

describe("ChatPanel — Escape (#144)", () => {
  const quiet = () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([])));
    vi.stubGlobal("WebSocket", QuietSocket);
    return render(<ChatPanel me="지은" {...shell} />);
  };
  /** `false` once something used the key — what tells the window to stay. */
  const escape = (element: Element) => fireEvent.keyDown(element, { key: "Escape" });

  it("leaves the window to close an empty input, and keeps a draft or a file", () => {
    const { container } = quiet();
    const input = screen.getByRole("textbox", { name: "채팅 메시지" });

    assert.equal(escape(input), true);
    fireEvent.change(input, { target: { value: "초안" } });
    assert.equal(escape(input), false);

    fireEvent.change(input, { target: { value: "" } });
    const file = new File(["x"], "사진.png", { type: "image/png" });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    assert.equal(escape(input), false);
  });

  it("keeps a draft from an Escape anywhere in the panel, but not from a dialog's own", () => {
    const { container } = quiet();
    fireEvent.change(screen.getByRole("textbox", { name: "채팅 메시지" }), { target: { value: "초안" } });
    const files = screen.getByRole("button", { name: "파일", pressed: false });
    fireEvent.click(files);

    assert.equal(escape(files), false);
    assert.equal(escape(container.querySelector("dialog")!), true);
  });

  it("closes the document picker first", () => {
    quiet();
    const button = screen.getByRole("button", { name: "문서 링크 첨부" });
    fireEvent.click(button);

    assert.equal(escape(button), false);
    assert.equal(screen.queryByText("어느 문서를 보낼까요?"), null);
    assert.equal(escape(button), true);
  });
});
