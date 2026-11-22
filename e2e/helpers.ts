import { expect, type APIRequestContext, type Page } from "@playwright/test";

export async function createDocument(page: Page, name: string): Promise<string> {
  const response = await page.request.post("/api/documents", { data: { name } });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).document.id;
}

/** Opens a document and waits for its first block — never for `networkidle`:
 *  the workspace socket and Yorkie's watch stream stay open for good. Firefox and WebKit call the
 *  goto aborted when a client-side navigation of the page being left lands at the same moment;
 *  that one is tried again, any other failure is not. */
export async function openDocument(page: Page, id: string): Promise<void> {
  const path = `/documents/${id}`;
  await page.goto(path).catch((error: unknown) => {
    if (!/NS_BINDING_ABORTED|interrupted by another navigation/.test(String(error))) throw error;
    return page.goto(path);
  });
  await expect(firstBlock(page)).toBeVisible();
}

/** Anchored on the block row, not a bare `textarea` — the page has others. */
export function firstBlock(page: Page) {
  return page.locator("[data-block-id] textarea").first();
}

export async function firstBlockId(page: Page): Promise<string> {
  await expect(firstBlock(page)).toBeVisible();
  return (await page.locator("[data-block-id]").first().getAttribute("data-block-id"))!;
}

export function block(page: Page, id: string) {
  return page.locator(`[data-block-id="${id}"] textarea`);
}

export function browserName(page: Page): string | undefined {
  return page.context().browser()?.browserType().name();
}

/** Firefox empties the data of a paste event a page builds itself, so there the text goes through
 *  a real copy and paste instead. */
async function pasteThroughClipboard(page: Page, id: string, text: string): Promise<void> {
  await page.evaluate((value) => {
    const source = document.createElement("textarea");
    source.id = "e2e-paste-source";
    source.value = value;
    document.body.append(source);
    source.select();
  }, text);
  await page.keyboard.press("ControlOrMeta+C");
  await page.evaluate(() => document.getElementById("e2e-paste-source")?.remove());
  await block(page, id).focus();
  await page.keyboard.press("ControlOrMeta+V");
}

/** A paste event as the browser fires one, so the editor's multi-line paste lays the blocks out. */
export async function paste(page: Page, id: string, text: string): Promise<void> {
  if (browserName(page) === "firefox") return pasteThroughClipboard(page, id, text);
  await block(page, id).evaluate((el, value) => {
    const data = new DataTransfer();
    data.setData("text/plain", value);
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, text);
}

export async function blockValues(page: Page): Promise<Array<{ id: string; text: string }>> {
  return page.locator("[data-block-id]").evaluateAll((rows) => rows.map((row) => ({
    id: row.getAttribute("data-block-id")!,
    text: (row.querySelector("textarea") as HTMLTextAreaElement)?.value ?? "",
  })));
}

export async function blockTexts(page: Page): Promise<Array<string>> {
  return (await blockValues(page)).map((row) => row.text);
}

export async function selectRange(page: Page, id: string, start: number, end = start): Promise<void> {
  const target = block(page, id);
  await target.focus();
  await target.evaluate((element, range) => {
    const textarea = element as HTMLTextAreaElement;
    textarea.setSelectionRange(range.start, range.end);
  }, { start, end });
}

export async function insertAt(page: Page, id: string, offset: number, text: string): Promise<void> {
  await selectRange(page, id, offset);
  await page.keyboard.insertText(text);
}

export async function joinForm(page: Page, name: string, accessPassword: string): Promise<void> {
  await page.getByLabel("닉네임").fill(name);
  await page.getByLabel("워크스페이스 비밀번호").fill(accessPassword);
  await page.getByRole("button", { name: "입장", exact: true }).click();
}

/** Signs `page` in as the host. A spec that calls it sets `test.use({ trace: "off" })`:
 *  the bootstrap URL and the role cookie both carry the host secret. */
export async function bootstrapHost(page: Page): Promise<void> {
  const secret = process.env.E2E_HOST_SECRET;
  if (!secret) throw new Error("Set E2E_HOST_SECRET from this stack's startup banner, or use pnpm e2e:isolated.");
  await page.goto("/join");
  // Browser-side navigation keeps the credential out of Playwright step titles.
  await page.evaluate((credential) => {
    window.location.assign(`/api/auth/host?secret=${encodeURIComponent(credential)}`);
  }, secret);
  await expect(page.getByRole("complementary").getByRole("textbox", { name: "문서 제목 검색" })).toBeVisible();
}

/** The colour of `nickname`'s dot in `page`'s header, as computed. */
export function dotColour(page: Page, nickname: string): Promise<string> {
  return page.getByRole("banner").locator("li").filter({ hasText: nickname }).locator("span[style]").first()
    .evaluate((element) => getComputedStyle(element).backgroundColor);
}

export function online(page: Page, count: number) {
  return expect(page.getByRole("banner").getByText(`${count}명 접속 중`, { exact: true })).toHaveCount(1);
}

export async function openChat(page: Page): Promise<void> {
  await page.getByRole("button", { name: "채팅", exact: true }).click();
  await expect(page.getByRole("region", { name: "채팅" })).toBeVisible();
}

export async function sendChat(page: Page, text: string): Promise<void> {
  const chat = page.getByRole("region", { name: "채팅" });
  await chat.getByRole("textbox", { name: "채팅 메시지" }).fill(text);
  await chat.getByRole("button", { name: "전송", exact: true }).click();
}

export function chatRow(page: Page, text: string) {
  const chat = page.getByRole("region", { name: "채팅" });
  return chat.locator("li").filter({ has: page.getByText(text, { exact: true }) });
}

/** A 1×1 PNG — the smallest image the preview route serves inline. */
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

/** The file manager's row for `name`, on the tab of its kind. */
export async function fileRow(page: Page, tab: "이미지" | "PDF" | "기타", name: string) {
  await page.goto("/files");
  await page.getByRole("group", { name: "파일 종류" }).getByRole("button", { name: new RegExp(`^${tab} `) }).click();
  return page.getByRole("row").filter({ hasText: name });
}

/** Sends a chat message carrying a file, through the two requests the chat panel makes. */
export async function sendChatFile(
  api: APIRequestContext,
  file: { name: string; mimeType: string; buffer: Buffer },
): Promise<{ fileId: string; messageId: string }> {
  const uploaded = await api.post("/api/chat/files", { multipart: { file } });
  expect(uploaded.status(), await uploaded.text()).toBe(201);
  const { id: fileId } = (await uploaded.json()) as { id: string };
  const sent = await api.post("/api/chat", { data: { fileId } });
  expect(sent.status(), await sent.text()).toBe(201);
  return { fileId, messageId: ((await sent.json()) as { id: string }).id };
}
