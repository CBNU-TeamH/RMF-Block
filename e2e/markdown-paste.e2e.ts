import { expect, test } from "./fixtures";
import { block, blockValues, createDocument, firstBlockId, insertAt, openDocument, paste, selectRange } from "./helpers";

const SAMPLE = [
  "## 1. 채용 개요",
  "",
  "- **채용 신분:** 정규직 B2사원",
  "    - 경력 내용에 따라 *일부* 인정 가능",
  "- [x] 접수 완료",
  "---",
  "```js",
  "const a = 1;",
  "",
  "**not bold**",
  "```",
  "| 항목 | 내용 |",
  "|---|---|",
  "| 모집 | ICT |",
  "끝",
].join("\n");

test("pasted Markdown keeps its structure, and inline marks draw until the block is edited", async ({ users }) => {
  const { page } = await users.join(0);
  const id = await createDocument(page, `e2e markdown ${Date.now()}`);
  await openDocument(page, id);
  await paste(page, await firstBlockId(page), SAMPLE);

  await expect.poll(async () => (await blockValues(page)).map((row) => row.text).slice(0, 5)).toEqual([
    "1. 채용 개요",
    "",
    "**채용 신분:** 정규직 B2사원",
    "경력 내용에 따라 *일부* 인정 가능",
    "접수 완료",
  ]);
  const rows = await blockValues(page);
  const row = (index: number) => page.locator(`[data-block-id="${rows[index]!.id}"]`);

  await expect(row(3).locator("> div").first()).toHaveAttribute("style", /padding-left: 24px/);
  await expect(row(4).getByRole("checkbox")).toBeChecked();
  await expect(row(5).locator("hr")).toHaveCount(1);
  await expect(row(6).locator("textarea")).toHaveValue("const a = 1;\n\n**not bold**");
  await expect(row(6).locator("strong:visible")).toHaveCount(0);
  await expect(row(7).getByRole("table", { name: "표" }).locator("textarea")).toHaveCount(4);
  await expect(row(7).getByRole("table", { name: "표" }).locator("textarea").nth(3)).toHaveValue("ICT");
  await expect(row(8).locator("textarea")).toHaveValue("끝");

  // Drawn while another block has the caret; the markers come back on focus. `:visible`
  // passes over each block's print copy, which draws the same marks hidden on screen.
  await expect(row(2).locator("strong:visible")).toHaveText("채용 신분:");
  await expect(row(3).locator("em:visible")).toHaveText("일부");
  await block(page, rows[2]!.id).click();
  await expect(row(2).locator("strong:visible")).toHaveCount(0);
  await block(page, rows[8]!.id).click();
  await expect(row(2).locator("strong:visible")).toHaveText("채용 신분:");
});

test("Ctrl/Cmd+B wraps the selection, and a peer sees it bold", async ({ users }) => {
  const a = await users.join(0);
  const b = await users.join(1);
  const id = await createDocument(a.page, `e2e bold ${Date.now()}`);
  await openDocument(a.page, id);
  await openDocument(b.page, id);

  const blockId = await firstBlockId(a.page);
  await insertAt(a.page, blockId, 0, "make this bold");
  await selectRange(a.page, blockId, 10, 14);
  await a.page.keyboard.press("ControlOrMeta+b");
  await expect(block(a.page, blockId)).toHaveValue("make this **bold**");

  await expect(b.page.locator(`[data-block-id="${blockId}"] strong:visible`)).toHaveText("bold");
});
