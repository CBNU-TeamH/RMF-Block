// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("./focus-follow-provider.tsx", () => ({ useFocusFollow: () => ({ goToBlock: vi.fn() }) }));
vi.mock("./floating-views.tsx", () => ({ useFloatingViews: () => vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import type { ChatMessage } from "@/lib/chat/types";
import { ChatMessageRow } from "./chat-message.tsx";

afterEach(cleanup);

const withFile = (fileName: string, fileType: string): ChatMessage => ({
  id: fileName,
  sender: "민수",
  text: "",
  sentAt: "2026-11-22T01:00:00.000Z",
  attachment: { fileId: `f-${fileName}`, fileName, fileType, size: 2048 },
});

describe("ChatMessageRow", () => {
  it("says a file card cannot be previewed only when the preview route will not serve it (FR-080-05)", () => {
    render(
      <ul>
        <ChatMessageRow message={withFile("notes.zip", "application/zip")} mine={false} colorTag={undefined} />
        <ChatMessageRow message={withFile("plan.pdf", "application/pdf")} mine={false} colorTag={undefined} />
      </ul>,
    );
    const card = (name: string) => screen.getByText(name).closest("a")!.textContent;

    assert.match(card("notes.zip")!, /2(\.0)? KB · 미리보기 불가 · 내려받기/);
    assert.doesNotMatch(card("plan.pdf")!, /미리보기 불가/);
  });
});
