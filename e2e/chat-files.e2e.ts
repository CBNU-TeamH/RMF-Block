import { expect, test } from "@playwright/test";

import { joinedPage, nickname } from "./helpers";

/** A 1×1 PNG — the smallest image the preview route serves inline. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

/**
 * #143 + #146: an image sent in chat shows up in the chat file list, and its
 * preview opens a floating view of the file that survives a reload.
 */
test("a chat image is listed and previews in a floating view", async ({ browser }) => {
  const page = await joinedPage(browser, nickname("files"));
  const fileName = `e2e-${Date.now()}.png`;

  const upload = await page.request.post("/api/chat/files", {
    multipart: { file: { name: fileName, mimeType: "image/png", buffer: PNG } },
  });
  expect(upload.status(), await upload.text()).toBe(201);
  const sent = await page.request.post("/api/chat", {
    data: { text: "", fileId: (await upload.json()).id },
  });
  expect(sent.ok(), await sent.text()).toBe(true);

  await page.goto("/");
  await page.getByRole("button", { name: "채팅", exact: true }).click();
  const chat = page.getByRole("region", { name: "채팅" });
  await chat.getByRole("button", { name: "파일", exact: true }).click();
  await chat.getByRole("button", { name: `${fileName} 미리보기` }).click();

  const view = page.getByRole("region", { name: `플로팅 뷰: ${fileName}` });
  await expect(view.getByRole("img", { name: fileName })).toBeVisible();

  // Restored from this browser's saved list, without the chat open.
  await page.reload();
  await expect(view.getByRole("img", { name: fileName })).toBeVisible();

  await view.getByRole("button", { name: "플로팅 뷰 닫기" }).click();
  await expect(view).toHaveCount(0);
});
