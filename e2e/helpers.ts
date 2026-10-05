import { expect, type Browser, type Page } from "@playwright/test";

const password = process.env.E2E_WORKSPACE_PASSWORD;

/** Unique per run and inside the 20-character nickname limit, so reruns against
 *  the same `.data/` never collide with a member left by an earlier run. */
export function nickname(label: string): string {
  return `e2e-${Date.now().toString(36)}-${label}`.slice(0, 20);
}

/** A browser context that has joined the workspace. The join goes through the
 *  API, not the form — the form has its own tests; this is the way in. */
export async function joinedPage(browser: Browser, name: string): Promise<Page> {
  if (!password) throw new Error("Set E2E_WORKSPACE_PASSWORD to the stack's WORKSPACE_PASSWORD.");

  const context = await browser.newContext();
  const response = await context.request.post("/api/workspace/join", {
    data: { nickname: name, password, force: true },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return context.newPage();
}

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
