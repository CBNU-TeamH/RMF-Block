import { expect, test } from "./fixtures";
import { createDocument, openChat, openDocument } from "./helpers";

/** A 1×1 PNG — the smallest image the preview route serves inline. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

/**
 * UC-050: an image put into a document is listed under its document, 원본 위치
 * lands on its block (E3-3), and deleting the block takes it off the list
 * (FR-050-06). Which block holds a file is read from Yorkie, so the list is
 * reloaded until the deletion has reached it.
 */
test("a document image is listed, jumps to its block, and leaves with the block", async ({ users }) => {
  const page = (await users.join(0)).page;
  const stamp = Date.now();
  const documentName = `e2e files ${stamp}`;
  const fileName = `e2e-doc-${stamp}.png`;
  const documentId = await createDocument(page, documentName);

  await openDocument(page, documentId);
  await page
    .locator("label")
    .filter({ hasText: "파일 추가" })
    .locator('input[type="file"]')
    .setInputFiles({ name: fileName, mimeType: "image/png", buffer: PNG });
  const image = page.locator("[data-block-id]").filter({ has: page.getByRole("img", { name: fileName }) });
  await expect(image).toBeVisible();
  const blockId = await image.getAttribute("data-block-id");

  await page.getByRole("link", { name: "파일", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: fileName });
  await expect(row).toContainText(documentName);

  await row.getByRole("button", { name: `${fileName} 원본 위치` }).click();
  await expect(page).toHaveURL(new RegExp(`/documents/${documentId}$`));
  await expect(page.locator(`[data-block-id="${blockId}"]`)).toBeInViewport();

  // Two steps: the block asks before it deletes.
  await image.getByRole("button", { name: "삭제", exact: true }).click();
  await image.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(image).toHaveCount(0);
  await expect(async () => {
    await page.goto("/files");
    await expect(page.getByRole("heading", { name: "파일" })).toBeVisible();
    await expect(page.getByRole("group", { name: "파일 종류" })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: fileName })).toHaveCount(0);
  }).toPass();
});

/** A chat attachment is listed too, and its 원본 위치 opens the chat at the message. */
test("a chat file is listed as 채팅 and opens the chat at its message", async ({ users }) => {
  const page = (await users.join(0)).page;
  const fileName = `e2e-chat-${Date.now()}.png`;
  await page.goto("/");
  await openChat(page);
  const chat = page.getByRole("region", { name: "채팅" });
  await chat.locator('input[type="file"]').setInputFiles({ name: fileName, mimeType: "image/png", buffer: PNG });
  await chat.getByRole("button", { name: "전송", exact: true }).click();
  await expect(chat.getByRole("img", { name: fileName })).toBeVisible();
  await chat.getByRole("button", { name: "채팅 닫기" }).click();

  await page.getByRole("link", { name: "파일", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: fileName });
  await expect(row).toContainText("채팅");
  await row.getByRole("button", { name: `${fileName} 원본 위치` }).click();

  await expect(chat).toBeVisible();
  await expect(chat.locator("li[data-message-id]").filter({ has: page.getByRole("img", { name: fileName }) })).toBeInViewport();
});
