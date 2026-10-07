import { expect, test } from "./fixtures";
import { online, openChat } from "./helpers";

/** A 1×1 PNG — the smallest image the preview route serves inline. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

/**
 * #143 + #146: an image sent in chat shows up in the chat file list, and its
 * preview opens a floating view of the file that survives a reload.
 */
test("a chat image is listed and previews in a floating view", async ({ users }) => {
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

  const view = peer.getByRole("region", { name: `플로팅 뷰: ${fileName}` });
  await expect(view.getByRole("img", { name: fileName })).toBeVisible();

  // Restored from this browser's saved list, without the chat open.
  await peer.reload();
  await expect(view.getByRole("img", { name: fileName })).toBeVisible();

  await view.getByRole("button", { name: "플로팅 뷰 닫기" }).click();
  await expect(view).toHaveCount(0);
});
