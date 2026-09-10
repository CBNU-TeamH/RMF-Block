// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import { JoinForm } from "./join-form.tsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

/** Fills the form, submits it, and lets the mocked 409 open the takeover
 *  dialog — the shared starting point both tests below build on. */
async function openTakeoverDialog(user: ReturnType<typeof userEvent.setup>) {
  render(<JoinForm />);

  await user.type(screen.getByLabelText("닉네임"), "누군가");
  await user.type(screen.getByLabelText("워크스페이스 비밀번호"), "password");
  await user.click(screen.getByRole("button", { name: "입장" }));

  await screen.findByRole("button", { name: "계속" });
}

describe("JoinForm — takeover dialog", () => {
  it("blocks dismissing while a forced join is in flight", async () => {
    const user = userEvent.setup();
    // The second call (the forced join) never resolves in this test — only
    // whether dismissal is blocked while it's outstanding is under test.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(jsonResponse(409, {})).mockReturnValueOnce(new Promise(() => {})),
    );
    await openTakeoverDialog(user);

    await user.click(screen.getByRole("button", { name: "계속" }));

    const dismissButton = screen.getByRole("button", { name: "다른 이름 쓰기" });
    assert.equal(dismissButton.hasAttribute("disabled"), true);

    const dialog = screen.getByRole("dialog", { hidden: true });
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    assert.equal(dialog.hasAttribute("open"), true);
  });

  it("moves focus to the failed field once a forced join fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(409, {}))
        .mockResolvedValueOnce(jsonResponse(401, { error: "비밀번호가 올바르지 않습니다." })),
    );
    await openTakeoverDialog(user);

    await user.click(screen.getByRole("button", { name: "계속" }));

    // `waitFor`'s own polling doesn't reliably surface a failed condition as
    // a clean assertion error in this environment — a broken fix hangs the
    // worker instead of failing fast (confirmed by temporarily reverting the
    // fix this test guards). The async work here is a single mocked fetch
    // resolving and its .then chain running, which a couple of flushed
    // microtask turns cover deterministically without polling.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    assert.equal(document.activeElement, screen.getByLabelText("워크스페이스 비밀번호"));
    const dialog = screen.getByRole("dialog", { hidden: true });
    assert.equal(dialog.hasAttribute("open"), false);
  });
});
