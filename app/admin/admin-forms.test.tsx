// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const refresh = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push }) }));

import { GuestList, SetupForm } from "./admin-forms.tsx";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const guests = [{ id: "m-1", nickname: "민수", colorTag: "#222" }];

describe("GuestList — kick (FR-011-01~03)", () => {
  it("asks first, and sends nothing until the host confirms", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<GuestList guests={guests} />);

    fireEvent.click(screen.getByRole("button", { name: "퇴장" }));
    assert.ok(screen.getByText("민수님을 퇴장시킬까요?"));
    assert.equal(fetchMock.mock.calls.length, 0);

    // The dialog's confirm is the second 퇴장 button in the DOM.
    fireEvent.click(screen.getAllByRole("button", { name: "퇴장", hidden: true })[1]!);
    await waitFor(() => assert.equal(refresh.mock.calls.length, 1));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    assert.equal(url, "/api/workspace/members/m-1");
    assert.equal(init.method, "DELETE");
  });

  it("cancel sends nothing", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<GuestList guests={guests} />);

    fireEvent.click(screen.getByRole("button", { name: "퇴장" }));
    fireEvent.click(screen.getByRole("button", { name: "취소", hidden: true }));

    assert.equal(fetchMock.mock.calls.length, 0);
  });

  it("says so when nobody is connected", () => {
    render(<GuestList guests={[]} />);
    assert.ok(screen.getByText("접속 중인 게스트가 없습니다."));
  });
});

describe("SetupForm (UC-010)", () => {
  const submit = () => {
    render(<SetupForm />);
    fireEvent.change(screen.getByLabelText("접속 비밀번호"), { target: { value: "1234" } });
    fireEvent.submit(screen.getByRole("button", { name: "워크스페이스 열기" }));
  };

  it("goes into the workspace once opened", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    submit();
    await waitFor(() => assert.equal(push.mock.calls[0]?.[0], "/"));
  });

  it("re-renders on a refusal, so a workspace another tab opened shows its manage view", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "이미 열린 워크스페이스입니다." }, { status: 409 })));
    submit();
    await waitFor(() => assert.equal(refresh.mock.calls.length, 1));
    assert.equal(push.mock.calls.length, 0);
    assert.ok(screen.getByText("이미 열린 워크스페이스입니다."));
  });
});
