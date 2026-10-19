import { expect, test } from "./fixtures";
import { online, openChat } from "./helpers";

/** A 1×1 PNG — the smallest image the preview route serves inline. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

/**
 * #146: an image sent in chat shows up in the chat file list, whose preview
 * opens the preview window. #143: the message's own 플로팅 뷰로 열기 opens a
 * floating view of the file that survives a reload.
 */
test("a chat image is listed, previews in the window, and floats from its message", async ({ users }) => {
  const page = (await users.join(0)).page;
  const fileName = `e2e-${Date.now()}.png`;

  const peer = (await users.join(1)).page;
  await page.goto("/");
  await peer.goto("/");
  await online(page, 2);
  await openChat(page);
  await openChat(peer);
  const senderChat = page.getByRole("region", { name: "채팅" });
  await senderChat.locator('input[type="file"]').setInputFiles({ name: fileName, mimeType: "image/png", buffer: PNG });
  await senderChat.getByRole("button", { name: "전송", exact: true }).click();
  const chat = peer.getByRole("region", { name: "채팅" });
  await chat.getByRole("button", { name: "파일", exact: true }).click();
  await chat.getByRole("button", { name: `${fileName} 미리보기` }).click();

  const preview = peer.getByRole("dialog", { name: `${fileName} 미리보기` });
  await expect(preview.getByRole("img", { name: fileName })).toBeVisible();
  await preview.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(preview).toBeHidden();

  // Anchored on this test's message: the run's other chat images share the history.
  await chat.getByRole("button", { name: "대화", exact: true }).click();
  await chat
    .locator("li[data-message-id]")
    .filter({ has: peer.getByRole("img", { name: fileName }) })
    .getByRole("button", { name: "플로팅 뷰로 열기" })
    .click();
  const view = peer.getByRole("region", { name: `플로팅 뷰: ${fileName}` });
  await expect(view.getByRole("img", { name: fileName })).toBeVisible();

  // Restored from this browser's saved list, without the chat open.
  await peer.reload();
  await expect(view.getByRole("img", { name: fileName })).toBeVisible();

  await view.getByRole("button", { name: "플로팅 뷰 닫기" }).click();
  await expect(view).toHaveCount(0);
});
