// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { WorkspaceDocument } from "@/lib/documents/documents";

import { DocumentActionDialog, type DocumentAction } from "./document-actions.tsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const doc = (id: string, name: string, parentId: string | null = null): WorkspaceDocument => ({
  id,
  name,
  parentId,
  createdBy: "m-1",
  createdAt: "2026-09-14T00:00:00.000Z",
  updatedAt: "2026-09-14T00:00:00.000Z",
});

/** parent → child → grandchild, plus one unrelated document to move into. */
const documents = [
  doc("parent", "부모"),
  doc("child", "자식", "parent"),
  doc("grandchild", "손자", "child"),
  doc("other", "다른 문서"),
];

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

function open(action: DocumentAction, fetchMock = vi.fn()) {
  vi.stubGlobal("fetch", fetchMock);
  const onDone = vi.fn();
  const onClose = vi.fn();

  render(
    <DocumentActionDialog
      action={action}
      documents={documents}
      onClose={onClose}
      onDone={onDone}
    />,
  );

  return { fetchMock, onDone, onClose };
}

describe("rename", () => {
  it("sends only a name, since the route refuses a request carrying both", async () => {
    const user = userEvent.setup();
    const { fetchMock } = open(
      { kind: "rename", document: doc("child", "자식", "parent") },
      vi.fn().mockResolvedValue(jsonResponse(200, { document: doc("child", "새 이름", "parent") })),
    );

    await user.clear(screen.getByLabelText("문서 이름"));
    await user.type(screen.getByLabelText("문서 이름"), "새 이름");
    await user.click(screen.getByRole("button", { name: "이름 변경" }));

    const [url, init] = fetchMock.mock.calls[0];
    assert.equal(url, "/api/documents/child");
    assert.equal(init.method, "PATCH");
    assert.deepEqual(JSON.parse(init.body), { name: "새 이름" });
  });

  /** FR-023-02's clash is the server's answer, not a check repeated here — the
   *  catalogue can gain a sibling between the keystroke and the request. What
   *  this file owes is showing what came back. */
  it("shows the server's clash message rather than inventing one", async () => {
    const user = userEvent.setup();
    open(
      { kind: "rename", document: doc("child", "자식", "parent") },
      vi.fn().mockResolvedValue(
        jsonResponse(400, { error: "같은 위치에 같은 이름의 문서가 있습니다." }),
      ),
    );

    await user.click(screen.getByRole("button", { name: "이름 변경" }));

    assert.ok(await screen.findByRole("alert"));
    assert.match(screen.getByRole("alert").textContent ?? "", /같은 이름의 문서/);
  });
});

describe("move", () => {
  /** `wouldCycle` refuses a move into the document's own subtree. Offering one
   *  and then rendering the rejection is a worse UI than never offering it, so
   *  the option list applies the same rule before the request. */
  it("offers neither the document itself nor anything under it", () => {
    open({ kind: "move", document: doc("parent", "부모") });

    const options = screen
      .getAllByRole("option")
      .map((option) => (option as HTMLOptionElement).textContent);

    assert.deepEqual(options, ["워크스페이스 최상위", "다른 문서"]);
  });

  it("moves to the root as an explicit null, not as a missing field", async () => {
    const user = userEvent.setup();
    const { fetchMock } = open(
      { kind: "move", document: doc("child", "자식", "parent") },
      vi.fn().mockResolvedValue(jsonResponse(200, { document: doc("child", "자식") })),
    );

    await user.selectOptions(screen.getByLabelText("옮길 위치"), "__root__");
    await user.click(screen.getByRole("button", { name: "이동" }));

    assert.deepEqual(JSON.parse(fetchMock.mock.calls[0][1].body), { parentId: null });
  });
});

describe("delete", () => {
  /** FR-023-05 asks first, and FR-023-06 takes the subtree with it. "2개도 함께
   *  삭제됩니다" is a different decision from deleting one document, and the
   *  person clicking is the only one who can tell them apart. */
  it("names how many documents go with it", () => {
    open({ kind: "delete", document: doc("parent", "부모") });

    assert.match(document.body.textContent ?? "", /하위 문서 2개도 함께 삭제됩니다/);
  });

  it("says only that it cannot be undone when nothing is under it", () => {
    open({ kind: "delete", document: doc("other", "다른 문서") });

    assert.doesNotMatch(document.body.textContent ?? "", /하위 문서/);
    assert.match(document.body.textContent ?? "", /되돌릴 수 없습니다/);
  });

  it("does not write until the confirm button is pressed", async () => {
    const user = userEvent.setup();
    const { fetchMock, onClose } = open({ kind: "delete", document: doc("other", "다른 문서") });

    await user.click(screen.getByRole("button", { name: "취소" }));

    assert.equal(fetchMock.mock.calls.length, 0);
    assert.equal(onClose.mock.calls.length, 1);
  });
});
