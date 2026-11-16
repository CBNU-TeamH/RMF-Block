import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { block, blockValues, createDocument, firstBlockId, openDocument } from "./helpers";

/** A paste event as the browser fires one, so the editor's multi-line paste lays the blocks out. */
async function paste(page: Page, id: string, text: string): Promise<void> {
  await block(page, id).evaluate((el, value) => {
    const data = new DataTransfer();
    data.setData("text/plain", value);
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, text);
}

/** What the next copy put on the clipboard, read after the editor's own handler. */
async function copied(page: Page): Promise<string> {
  await page.evaluate(() => {
    window.addEventListener("copy", (event) => {
      (window as unknown as { copied?: string }).copied = event.clipboardData?.getData("text/plain");
    }, { once: true });
  });
  await page.keyboard.press("ControlOrMeta+c");
  return page.evaluate(() => (window as unknown as { copied?: string }).copied ?? "");
}

async function threeBlocks(page: Page): Promise<Array<string>> {
  const id = await createDocument(page, `e2e select ${Date.now()}`);
  await openDocument(page, id);
  await paste(page, await firstBlockId(page), "# 제목\n- **항목**\n본문");
  await expect.poll(async () => (await blockValues(page)).map((row) => row.text).slice(0, 3)).toEqual(["제목", "**항목**", "본문"]);
  return (await blockValues(page)).map((row) => row.id);
}

const selectedRows = (page: Page) => page.locator("[data-block-id][data-selected]");

test("dragging across blocks selects them whole and copies them as Markdown", async ({ users }) => {
  const { page } = await users.join(0);
  const [heading, , body] = await threeBlocks(page);

  const from = (await block(page, heading!).boundingBox())!;
  const to = (await block(page, body!).boundingBox())!;
  await page.mouse.move(from.x + 4, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + 8, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();

  await expect(selectedRows(page)).toHaveCount(3);
  expect(await copied(page)).toBe("# 제목\n- **항목**\n본문");

  // A plain click ends the selection and puts the caret back in a block.
  await block(page, body!).click();
  await expect(selectedRows(page)).toHaveCount(0);
  await expect(block(page, body!)).toBeFocused();
});

test("Shift+click extends from the focused block, and Escape gives the caret back", async ({ users }) => {
  const { page } = await users.join(0);
  const [heading, item] = await threeBlocks(page);

  await block(page, heading!).click();
  await block(page, item!).click({ modifiers: ["Shift"] });
  await expect(selectedRows(page)).toHaveCount(2);
  expect(await copied(page)).toBe("# 제목\n- **항목**");

  await page.keyboard.press("Escape");
  await expect(selectedRows(page)).toHaveCount(0);
  await expect(block(page, item!)).toBeFocused();
});

test("Ctrl/Cmd+A selects the block's text, then every block", async ({ users }) => {
  const { page } = await users.join(0);
  const ids = await threeBlocks(page);

  await block(page, ids[1]!).click();
  await page.keyboard.press("ControlOrMeta+a");
  await expect(selectedRows(page)).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+a");
  await expect(selectedRows(page)).toHaveCount(ids.length);
  expect(await copied(page)).toMatch(/^# 제목\n- \*\*항목\*\*\n본문/);
});
