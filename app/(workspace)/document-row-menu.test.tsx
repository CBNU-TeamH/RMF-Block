// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DocumentRowMenu } from "./document-row-menu.tsx";

afterEach(cleanup);

/** Nothing here asserts on position: happy-dom has no layout, so every rect is
 *  zero and `getBoundingClientRect` cannot say whether the menu landed where it
 *  should. That half is checked in a browser (see the task doc); these pin the
 *  interaction contract, which is what regresses when someone edits the file. */
function open(onSelect = vi.fn()) {
  render(
    <DocumentRowMenu
      label="회의록"
      items={[
        { label: "새 하위 문서", onSelect },
        { label: "이름 변경", onSelect },
        { label: "이동", onSelect },
        { label: "삭제", onSelect, danger: true },
      ]}
    />,
  );

  return { onSelect, trigger: screen.getByRole("button", { name: "회의록 메뉴" }) };
}

describe("DocumentRowMenu", () => {
  it("keeps the menu closed until the trigger is pressed", () => {
    const { trigger } = open();

    assert.equal(screen.queryByRole("menu"), null);
    assert.equal(trigger.getAttribute("aria-expanded"), "false");
  });

  it("opens with every action, and marks only the irreversible one", async () => {
    const user = userEvent.setup();
    const { trigger } = open();

    await user.click(trigger);

    assert.deepEqual(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
      ["새 하위 문서", "이름 변경", "이동", "삭제"],
    );
    assert.match(screen.getByRole("menuitem", { name: "삭제" }).className, /text-danger/);
    assert.equal(trigger.getAttribute("aria-expanded"), "true");
  });

  /** The menu is reachable and usable without a mouse, which `opacity-0` plus a
   *  hover-only reveal would quietly break. */
  it("puts focus on the first action so the keyboard can carry on", async () => {
    const user = userEvent.setup();
    const { trigger } = open();

    await user.click(trigger);

    assert.equal(document.activeElement, screen.getByRole("menuitem", { name: "새 하위 문서" }));
  });

  it("runs the chosen action once and closes", async () => {
    const user = userEvent.setup();
    const { trigger, onSelect } = open();

    await user.click(trigger);
    await user.click(screen.getByRole("menuitem", { name: "이동" }));

    assert.equal(onSelect.mock.calls.length, 1);
    assert.equal(screen.queryByRole("menu"), null);
  });

  /** Escape has to hand focus back, or it lands on `<body>` and the next Tab
   *  restarts at the top of the page — a long document list is the worst place
   *  for that. */
  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    const { trigger } = open();

    await user.click(trigger);
    await user.keyboard("{Escape}");

    assert.equal(screen.queryByRole("menu"), null);
    assert.equal(document.activeElement, trigger);
  });

  it("closes when a press lands outside it", async () => {
    const user = userEvent.setup();
    const { trigger } = open();

    await user.click(trigger);
    await user.click(document.body);

    assert.equal(screen.queryByRole("menu"), null);
  });
});
