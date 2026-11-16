import { expect, test } from "./fixtures";
import { block, blockValues, insertAt } from "./helpers";

test("a Markdown file picked in the 새 문서 dialog becomes the new document's blocks", async ({ users }) => {
  const { page } = await users.join(0);
  await page.goto("/");
  const aside = page.getByRole("complementary");
  await aside.getByRole("button", { name: "새 문서", exact: true }).click();
  const dialog = page.getByRole("dialog");

  const name = `e2e import ${Date.now()}`;
  await dialog.getByLabel("마크다운 파일에서 가져오기").setInputFiles({
    name: `${name}.md`,
    mimeType: "text/markdown",
    buffer: Buffer.from("# 회의록\n\n첫 문단입니다.\n\n- 하나\n- 둘\n\n> 인용\n"),
  });
  await expect(dialog.getByText(`${name}.md`)).toBeVisible();
  await expect(dialog.getByLabel("문서 이름")).toHaveValue(name);
  await dialog.getByRole("button", { name: "만들기", exact: true }).click();

  const href = await aside.getByRole("link", { name, exact: true }).getAttribute("href");
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  // The blank lines between paragraphs are not blocks.
  await expect.poll(async () => (await blockValues(page)).map((row) => row.text)).toEqual([
    "회의록",
    "첫 문단입니다.",
    "하나",
    "둘",
    "인용",
  ]);

  // The import is part of creating the document, so an undo straight after it has nothing to take back.
  const rows = await blockValues(page);
  const last = rows[rows.length - 1]!.id;
  await block(page, last).focus();
  await page.keyboard.press("ControlOrMeta+z");
  await insertAt(page, last, 2, "!");
  // Typing may add the editor's trailing empty paragraph after the quote; only the import is compared.
  await expect.poll(async () => (await blockValues(page)).map((row) => row.text).slice(0, 5)).toEqual([
    "회의록",
    "첫 문단입니다.",
    "하나",
    "둘",
    "인용!",
  ]);
});
