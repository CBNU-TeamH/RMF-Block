// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const refresh = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push }) }));

import { GuestList, SetupForm, TrashList } from "./admin-forms.tsx";

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

  it("re-reads the list on 새로고침, without reloading the page", () => {
    render(<GuestList guests={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "새로고침" }));
    assert.equal(refresh.mock.calls.length, 1);
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

describe("TrashList — the host's trash", () => {
  const entry = {
    deletedAt: "2026-10-08T03:30:00.000Z",
    documents: [
      { id: "doc-1", name: "기획", parentId: null, createdBy: "m-1", createdAt: "", updatedAt: "" },
      { id: "doc-2", name: "회의록", parentId: "doc-1", createdBy: "m-1", createdAt: "", updatedAt: "" },
    ],
  };
  const ttlMs = 30 * 24 * 60 * 60 * 1000;

  it("says so when the trash is empty", () => {
    render(<TrashList entries={[]} ttlMs={ttlMs} />);
    assert.ok(screen.getByText("휴지통이 비어 있습니다."));
  });

  it("re-reads the trash on 새로고침, without reloading the page", () => {
    render(<TrashList entries={[entry]} ttlMs={ttlMs} />);
    fireEvent.click(screen.getByRole("button", { name: "새로고침" }));
    assert.equal(refresh.mock.calls.length, 1);
  });

  it("shows the root, how many documents come with it, and when it goes for good", () => {
    render(<TrashList entries={[entry]} ttlMs={ttlMs} />);

    assert.ok(screen.getByText("기획"));
    assert.ok(screen.getByText(/하위 문서 1개/));
    // 12:30 KST on the 8th, so 30 days on is 11월 7일 in Seoul.
    assert.ok(screen.getByText(/11월 7일 영구 삭제/));
  });

  it("restores by the root's id and re-reads the page", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<TrashList entries={[entry]} ttlMs={ttlMs} />);

    fireEvent.click(screen.getByRole("button", { name: "복원" }));

    await waitFor(() => assert.equal(refresh.mock.calls.length, 1));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    assert.equal(url, "/api/workspace/trash/doc-1/restore");
    assert.equal(init.method, "POST");
  });
});
