import { expect, test } from "./fixtures";
import { fileRow, openChat, PNG, sendChatFile } from "./helpers";

/**
 * STC-061-002: the chat's file list names each file with its kind, who sent it and when.
 */
test("the chat file list shows each file's name, kind, sender and time (FR-061-02)", async ({ users }) => {
  const sender = await users.join(0);
  const reader = (await users.join(1)).page;
  const name = `e2e-listed-${Date.now()}.png`;
  const before = Date.now();
  await sendChatFile(sender.context.request, { name, mimeType: "image/png", buffer: PNG });

  await reader.goto("/");
  await openChat(reader);
  const chat = reader.getByRole("region", { name: "채팅" });
  await chat.getByRole("button", { name: "파일", exact: true }).click();
  await chat.getByRole("group", { name: "파일 종류" }).getByRole("button", { name: /^이미지 / }).click();
  const row = chat.locator("li").filter({ hasText: name });
  await expect(row).toContainText(`이미지 · ${PNG.length} B · ${sender.name} ·`);
  const sentAt = Date.parse((await row.locator("time").getAttribute("datetime"))!);
  expect(sentAt).toBeGreaterThanOrEqual(before - 5_000);
  expect(sentAt).toBeLessThanOrEqual(Date.now() + 5_000);
});

/**
 * STC-050-005 and STC-080-003: a file the browser cannot show in place gets no 미리보기 but says 미리보기
 * 불가, in the chat's list and in the file manager, and its 내려받기 hands over the file itself.
 */
test("a file that cannot be shown in place says so and offers its download (FR-050-03, FR-050-04, FR-080-05)", async ({ users }) => {
  const { context, page } = await users.join(0);
  const name = `e2e-opaque-${Date.now()}.bin`;
  const bytes = Buffer.from([0, 1, 2, 3, 250, 251, 252, 253]);
  await sendChatFile(context.request, { name, mimeType: "application/octet-stream", buffer: bytes });

  await page.goto("/");
  await openChat(page);
  const chat = page.getByRole("region", { name: "채팅" });
  await chat.getByRole("button", { name: "파일", exact: true }).click();
  await chat.getByRole("group", { name: "파일 종류" }).getByRole("button", { name: /^문서 / }).click();
  // The message that carried the file is a list item too, so the list's row is the one without a message id.
  const listed = chat.locator("li:not([data-message-id])").filter({ hasText: name });
  await expect(listed.getByRole("link", { name: `${name} 내려받기` })).toBeVisible();
  await expect(listed.getByRole("button", { name: `${name} 미리보기` })).toHaveCount(0);
  await expect(listed).toContainText("미리보기 불가");
  await expect(chat.locator("li[data-message-id]").filter({ hasText: name })).toContainText("미리보기 불가");

  const row = await fileRow(page, "기타", name);
  await expect(row.getByRole("button", { name: `${name} 미리보기` })).toHaveCount(0);
  await expect(row).toContainText("미리보기 불가");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    row.getByRole("link", { name: `${name} 내려받기` }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(name);
  const saved = await download.createReadStream();
  const chunks: Array<Buffer> = [];
  for await (const chunk of saved) chunks.push(chunk as Buffer);
  expect(Buffer.concat(chunks).equals(bytes)).toBe(true);
});

/**
 * STC-080-002: 미리보기 is offered for PNG, JPEG, GIF, WebP and PDF only — not SVG or HTML. A chat
 * file keeps the type its sender claimed (`docs/design/api.md`, "Why preview and download are two
 * endpoints"), so a page claimed as a PNG is offered; it is served as `image/png` with `nosniff`,
 * and the viewer draws a broken image rather than running it. That is the design's defence, and
 * D07's expected result is aligned with it as for STC-022-016.
 */
test("미리보기 is offered only for the allowed types, and a disguised file is shown as a broken image, never run (FR-080-02)", async ({ users }) => {
  test.setTimeout(90_000);
  const { context, page } = await users.join(0);
  const api = context.request;
  const stamp = Date.now();
  const files: Array<{ name: string; mimeType: string; tab: Parameters<typeof fileRow>[1]; previews: boolean }> = [
    { name: `e2e-${stamp}.png`, mimeType: "image/png", tab: "이미지", previews: true },
    { name: `e2e-${stamp}.jpg`, mimeType: "image/jpeg", tab: "이미지", previews: true },
    { name: `e2e-${stamp}.gif`, mimeType: "image/gif", tab: "이미지", previews: true },
    { name: `e2e-${stamp}.webp`, mimeType: "image/webp", tab: "이미지", previews: true },
    { name: `e2e-${stamp}.pdf`, mimeType: "application/pdf", tab: "PDF", previews: true },
    { name: `e2e-${stamp}.svg`, mimeType: "image/svg+xml", tab: "이미지", previews: false },
    { name: `e2e-${stamp}.html`, mimeType: "text/html", tab: "기타", previews: false },
  ];
  for (const file of files) await sendChatFile(api, { name: file.name, mimeType: file.mimeType, buffer: PNG });
  await page.goto("/files");
  for (const file of files) {
    await page.getByRole("group", { name: "파일 종류" }).getByRole("button", { name: new RegExp(`^${file.tab} `) }).click();
    const row = page.getByRole("row").filter({ hasText: file.name });
    await expect(row).toHaveCount(1);
    await expect(row.getByRole("button", { name: `${file.name} 미리보기` }), file.name).toHaveCount(file.previews ? 1 : 0);
  }

  const disguised = `e2e-disguised-${stamp}.png`;
  const { fileId } = await sendChatFile(api, { name: disguised, mimeType: "image/png", buffer: Buffer.from("<script>alert('ran')</script>") });
  const served = await api.get(`/api/files/${fileId}/preview`);
  expect(served.headers()["content-type"]).toBe("image/png");
  expect(served.headers()["x-content-type-options"]).toBe("nosniff");
  let dialogs = 0;
  page.on("dialog", (dialog) => {
    dialogs += 1;
    void dialog.dismiss();
  });
  const row = await fileRow(page, "이미지", disguised);
  await row.getByRole("button", { name: `${disguised} 미리보기` }).click();
  const image = page.getByRole("dialog", { name: `${disguised} 미리보기` }).getByRole("img", { name: disguised });
  await expect(image).toHaveCount(1);
  await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).complete)).toBe(true);
  expect(await image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBe(0);
  expect(dialogs).toBe(0);
});

/**
 * STC-080-004: the viewer closes by its 닫기 button, by a click on the backdrop and by Esc, and takes
 * its content with it each time.
 */
test("the viewer closes by its button, the backdrop and Esc, and its content goes with it (FR-080-04)", async ({ users }) => {
  const { context, page } = await users.join(0);
  const name = `e2e-viewer-${Date.now()}.png`;
  await sendChatFile(context.request, { name, mimeType: "image/png", buffer: PNG });
  const row = await fileRow(page, "이미지", name);
  const viewer = page.getByRole("dialog", { name: `${name} 미리보기` });
  const content = page.locator("dialog img");

  const closings: Array<[string, () => Promise<void>]> = [
    ["닫기", () => viewer.getByRole("button", { name: "닫기", exact: true }).click()],
    ["backdrop", () => page.mouse.click(4, 4)],
    ["Esc", () => page.keyboard.press("Escape")],
  ];
  for (const [how, close] of closings) {
    await row.getByRole("button", { name: `${name} 미리보기` }).click();
    await expect(viewer.getByRole("img", { name })).toBeVisible();
    await close();
    await expect(viewer, how).toBeHidden();
    await expect(content, how).toHaveCount(0);
  }
});
