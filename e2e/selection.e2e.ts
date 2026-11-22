import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { block, blockTexts, browserName, blockValues, createDocument, firstBlockId, openDocument, paste } from "./helpers";

/** What the next copy (or cut, `x`) put on the clipboard, read after the editor's own handler.
 *  Playwright's Linux WebKit maps Ctrl+C to copy only in an editable field, so on a selection the
 *  browser would copy it fires nothing; there the copy is the editing command the shortcut stands for. */
async function copied(page: Page, key: "c" | "x" = "c"): Promise<string> {
  await page.evaluate(() => {
    window.addEventListener("copy", (event) => {
      (window as unknown as { copied?: string }).copied = event.clipboardData?.getData("text/plain");
    }, { once: true });
  });
  if (key === "c" && browserName(page) === "webkit") await page.evaluate(() => document.execCommand("copy"));
  else await page.keyboard.press(`ControlOrMeta+${key}`);
  return page.evaluate(() => (window as unknown as { copied?: string }).copied ?? "");
}

async function threeBlocks(page: Page): Promise<Array<string>> {
  const id = await createDocument(page, `e2e select ${Date.now()}`);
  await openDocument(page, id);
  await paste(page, await firstBlockId(page), "# 제목\n- **항목**\n본문");
  await expectPasted(page);
  return (await blockValues(page)).map((row) => row.id);
}

/** The three blocks `threeBlocks` pasted, back in place. */
const expectPasted = (page: Page) =>
  expect.poll(async () => (await blockTexts(page)).slice(0, 3)).toEqual(["제목", "**항목**", "본문"]);

const selectedRows = (page: Page) => page.locator("[data-block-id][data-selected]");

/** A mouse drag from one block's text into another's. */
async function drag(page: Page, fromId: string, toId: string): Promise<void> {
  const from = (await block(page, fromId).boundingBox())!;
  const to = (await block(page, toId).boundingBox())!;
  await page.mouse.move(from.x + 4, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + 8, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
}

test("dragging across blocks selects them whole and copies them as Markdown", async ({ users }) => {
  const { page } = await users.join(0);
  const [heading, , body] = await threeBlocks(page);

  await drag(page, heading!, body!);

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

test("Backspace deletes the selected blocks, and one undo brings them back", async ({ users }) => {
  const { page } = await users.join(0);
  const [heading, item, body] = await threeBlocks(page);

  await drag(page, heading!, item!);
  await expect(selectedRows(page)).toHaveCount(2);
  await page.keyboard.press("Backspace");

  // The editor keeps an empty text block at the end, as after any delete.
  await expect.poll(() => blockTexts(page)).toEqual(["본문", ""]);
  await expect(selectedRows(page)).toHaveCount(0);
  await expect(block(page, body!)).toBeFocused();

  await page.keyboard.press("ControlOrMeta+z");
  await expectPasted(page);
});

test("Delete on every block leaves one empty block with the caret in it", async ({ users }) => {
  const { page } = await users.join(0);
  const ids = await threeBlocks(page);

  await block(page, ids[1]!).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+a");
  await expect(selectedRows(page)).toHaveCount(ids.length);
  await page.keyboard.press("Delete");

  await expect.poll(() => blockTexts(page)).toEqual([""]);
  await expect(page.locator("[data-block-id] textarea").first()).toBeFocused();

  // One edit: the first undo does not strand the document without a block.
  await page.keyboard.press("ControlOrMeta+z");
  await expectPasted(page);
});

test("Ctrl/Cmd+X copies the selection as Markdown and deletes it", async ({ users }) => {
  const { page } = await users.join(0);
  const [heading, item, body] = await threeBlocks(page);

  await drag(page, heading!, item!);
  await expect(selectedRows(page)).toHaveCount(2);
  expect(await copied(page, "x")).toBe("# 제목\n- **항목**");

  await expect.poll(() => blockTexts(page)).toEqual(["본문", ""]);
  await expect(block(page, body!)).toBeFocused();
});
