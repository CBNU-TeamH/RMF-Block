import { expect, type Page } from "@playwright/test";

export async function createDocument(page: Page, name: string): Promise<string> {
  const response = await page.request.post("/api/documents", { data: { name } });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).document.id;
}

/** Opens a document and waits for its first block — never for `networkidle`:
 *  the workspace socket and Yorkie's watch stream stay open for good. */
export async function openDocument(page: Page, id: string): Promise<void> {
  await page.goto(`/documents/${id}`);
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

export async function blockValues(page: Page): Promise<Array<{ id: string; text: string }>> {
  return page.locator("[data-block-id]").evaluateAll((rows) => rows.map((row) => ({
    id: row.getAttribute("data-block-id")!,
    text: (row.querySelector("textarea") as HTMLTextAreaElement)?.value ?? "",
  })));
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
