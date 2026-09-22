// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { Client, Document } from "@yorkie-js/sdk";

import type { BlockDocumentRoot } from "@/lib/blocks/document";

import { VersionHistory } from "./version-history.tsx";

afterEach(cleanup);

/** `docRef.current` only has to be truthy — `client` is the mock everything
 *  actually goes through, and nothing here reads the stub's own shape. */
function open() {
  const client = {
    listRevisions: vi.fn().mockResolvedValue([]),
    getRevision: vi.fn(),
    createRevision: vi.fn(),
    sync: vi.fn(),
  } as unknown as Client;
  const docRef = { current: {} } as React.RefObject<Document<BlockDocumentRoot> | null>;

  render(
    <VersionHistory client={client} docRef={docRef} nickname="테스터" onRestore={vi.fn()} />,
  );

  return { trigger: screen.getByRole("button", { name: "버전 히스토리" }) };
}

describe("VersionHistory — closing on Escape", () => {
  it("closes the panel on Escape when nothing else is open", async () => {
    const user = userEvent.setup();
    const { trigger } = open();

    await user.click(trigger);
    assert.equal(trigger.getAttribute("aria-expanded"), "true");

    await user.keyboard("{Escape}");
    assert.equal(trigger.getAttribute("aria-expanded"), "false");
  });

  /** The regression this guards: the panel's own `keydown` listener must not
   *  also react while the nested `<dialog>` (수동 저장/복원 확인) is open, or one
   *  Escape press would be asked to close two layers at once. */
  it("does not close the panel on Escape while the save dialog is open", async () => {
    const user = userEvent.setup();
    const { trigger } = open();

    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "수동 저장" }));
    await user.keyboard("{Escape}");

    assert.equal(trigger.getAttribute("aria-expanded"), "true");
  });
});
