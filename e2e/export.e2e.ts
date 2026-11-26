import { readFile } from "node:fs/promises";

import { strFromU8, unzipSync } from "fflate";
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { PNG, block, blockValues, createDocument, firstBlockId, openDocument, paste } from "./helpers";

/** FR-022-15~17 in a browser: the layout and names are `lib/documents/export.test.mts`'s, the
 *  route's shapes its own test's; this proves the menu, the download and print media end to end. */

async function exportMarkdown(page: Page, choose?: "이 문서만" | "하위 문서 포함") {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "문서 내보내기 메뉴" }).click();
  await page.getByRole("menuitem", { name: "Markdown (.md)" }).click();
  if (choose) await page.getByRole("dialog").getByRole("button", { name: choose }).click();
  const download = await pending;
  return { name: download.suggestedFilename(), bytes: await readFile(await download.path()) };
}

test("a text-only document downloads as one .md in the import's own Markdown (FR-022-15)", async ({ users }) => {
  const { page } = await users.join(0);
  const name = `e2e export ${Date.now()}`;
  const id = await createDocument(page, name);
  await openDocument(page, id);
  await paste(page, await firstBlockId(page), "## 제목\n본문입니다.\n- 하나\n- 둘");
  await expect.poll(async () => (await blockValues(page)).map((row) => row.text).slice(0, 4)).toEqual(["제목", "본문입니다.", "하나", "둘"]);
  // The export reads what Yorkie stored, which the paste reaches a moment after the screen does.
  await expect.poll(async () => (await page.request.get(`/api/documents/${id}/export`)).text()).toContain("- 둘");

  const { name: fileName, bytes } = await exportMarkdown(page);

  expect(fileName).toBe(`${name}.md`);
  // The editor may keep an empty trailing block after a paste; it is only spacing.
  expect(bytes.toString("utf8").trimEnd()).toBe("## 제목\n\n본문입니다.\n\n- 하나\n- 둘");
});

test("a document with an image downloads as a zip holding the image byte for byte (FR-022-15)", async ({ users }) => {
  const { page } = await users.join(0);
  const name = `e2e export image ${Date.now()}`;
  const id = await createDocument(page, name);
  await openDocument(page, id);
  await page.locator("label").filter({ hasText: "파일 추가" }).locator('input[type="file"]').setInputFiles({
    name: "도표.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await expect(page.locator("[data-block-id] img")).toHaveCount(1);

  const { name: fileName, bytes } = await exportMarkdown(page);

  expect(fileName).toBe(`${name}.zip`);
  const files = unzipSync(new Uint8Array(bytes));
  expect(Object.keys(files).sort()).toEqual([`${name}.md`, `${name}/도표.png`].sort());
  expect(Buffer.from(files[`${name}/도표.png`]!).equals(PNG)).toBe(true);
  expect(strFromU8(files[`${name}.md`]!)).toContain(`![도표.png](<${name}/도표.png>)`);
});

test("a document with a sub-page asks first, and includes it as a folder when told to (FR-022-16)", async ({ users }) => {
  const { page } = await users.join(0);
  const name = `e2e export parent ${Date.now()}`;
  const id = await createDocument(page, name);
  const child = await page.request.post("/api/documents", { data: { name: "하위", parentId: id } });
  expect(child.status()).toBe(201);
  await openDocument(page, id);

  const only = await exportMarkdown(page, "이 문서만");
  expect(only.name).toBe(`${name}.md`);

  const all = await exportMarkdown(page, "하위 문서 포함");
  expect(all.name).toBe(`${name}.zip`);
  expect(Object.keys(unzipSync(new Uint8Array(all.bytes))).sort()).toEqual([`${name}.md`, `${name}/하위.md`].sort());
});

test("print media shows the document and hides the workspace around it (FR-022-17)", async ({ users }) => {
  const { page } = await users.join(0);
  const id = await createDocument(page, `e2e print ${Date.now()}`);
  await openDocument(page, id);
  const first = await firstBlockId(page);
  const text = "인쇄할 본문 ".repeat(40).trim();
  await paste(page, first, `${text}\n끝`);
  const copy = page.locator(`[data-block-id="${first}"] [data-print-copy]`);

  await page.emulateMedia({ media: "print" });
  // A page is narrower than the screen the block was sized on.
  await page.setViewportSize({ width: 500, height: 800 });

  // The textarea gives way to its print copy, which wraps at the page's width.
  await expect(block(page, first)).toBeHidden();
  await expect(copy).toBeVisible();
  await expect(copy).toHaveText(text);
  await expect(page.getByRole("complementary")).toBeHidden();
  await expect(page.getByRole("navigation", { name: "열린 문서" })).toBeHidden();
  await expect(page.getByRole("button", { name: "문서 내보내기 메뉴" })).toBeHidden();
  await expect(page.getByText("파일 추가")).toBeHidden();
});

test("a wide table fits the printed page (FR-022-17)", async ({ users }) => {
  const { page } = await users.join(0);
  const id = await createDocument(page, `e2e print table ${Date.now()}`);
  await openDocument(page, id);
  const first = await firstBlockId(page);
  const header = `| ${"긴 열 제목".repeat(3)} | b | c | d | e | f | g | h |`;
  await paste(page, first, [header, "|---|---|---|---|---|---|---|---|", "| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |"].join("\n"));
  const row = page.locator("[data-block-id]").filter({ has: page.locator("table") });
  const table = row.locator("table");
  await expect(table).toHaveCount(1);

  await page.emulateMedia({ media: "print" });
  await page.setViewportSize({ width: 500, height: 800 });

  // Every column fits inside the document's column rather than scrolling out of it.
  const [tableBox, rowBox] = await Promise.all([table.boundingBox(), row.boundingBox()]);
  expect(tableBox!.x + tableBox!.width).toBeLessThanOrEqual(rowBox!.x + rowBox!.width + 1);
  // And inside the page itself, in case the row overflows with it.
  expect(tableBox!.x + tableBox!.width).toBeLessThanOrEqual(500);
});
