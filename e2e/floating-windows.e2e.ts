import { expect, test } from "./fixtures";
import { blockValues, createDocument, firstBlock, openChat, openDocument } from "./helpers";

/**
 * #144 (UC-070, FR-070-06): with several floating windows open, the one pressed
 * comes to the front, Escape closes the one it is in and nothing else, and a
 * sixth floating view is refused with a notice.
 */
test("the pressed floating window comes to the front, Escape closes it, and a sixth view is refused", async ({ users }) => {
  test.setTimeout(90_000);
  const page = (await users.join(0)).page;
  const name = `e2e windows ${Date.now()}`;
  const document = await createDocument(page, name);

  await openDocument(page, document);
  await firstBlock(page).focus();
  for (let index = 0; index < 6; index++) {
    if (index > 0) await page.keyboard.press("Enter");
    await page.keyboard.insertText(`line ${index}`);
  }
  const rows = await blockValues(page);
  const float = async (text: string) => {
    const row = page.locator(`[data-block-id="${rows.find((entry) => entry.text === text)!.id}"]`);
    await row.hover();
    await row.getByRole("button", { name: "플로팅 뷰로 열기" }).click();
  };
  const views = page.getByRole("region", { name: `플로팅 뷰: ${name}` });
  const view = (text: string) => views.filter({ hasText: text });
  const z = (window: ReturnType<typeof view>) => window.evaluate((element) => Number((element as HTMLElement).style.zIndex));

  for (let index = 0; index < 5; index++) await float(`line ${index}`);
  await expect(views).toHaveCount(5);

  await float("line 5");
  await expect(page.getByText("플로팅 뷰는 최대 5개까지 열 수 있습니다.")).toBeVisible();
  await expect(views).toHaveCount(5);

  // Focus is on the editor's float button: its Escape belongs to no window.
  await page.keyboard.press("Escape");
  await expect(views).toHaveCount(5);

  // The chat window shares the order: it opens in front of every view.
  await openChat(page);
  const chat = page.getByRole("region", { name: "채팅" });
  expect(await z(chat)).toBeGreaterThan(await z(view("line 4")));

  // The first view is the backmost; the top of its title bar still shows.
  await view("line 0").locator("header").click({ position: { x: 12, y: 8 } });
  expect(await z(view("line 0"))).toBeGreaterThan(await z(chat));

  await page.keyboard.press("Escape");
  await expect(view("line 0")).toHaveCount(0);
  await expect(views).toHaveCount(4);
  await expect(chat).toBeVisible();
});
