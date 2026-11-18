import { expect, test } from "./fixtures";
import { blockValues, createDocument, firstBlock, openChat, openDocument, selectRange } from "./helpers";

/**
 * #144 and #224 (UC-070, FR-070-06): floating views open in the main area's
 * top-left. With several windows open, the one pressed comes to the front,
 * Escape closes the one it is in and nothing else, and a sixth floating view is
 * refused with a notice.
 */
test("floating windows open top-left, the pressed one comes to the front, Escape closes it, and a sixth is refused", async ({ users }) => {
  test.setTimeout(90_000);
  const page = (await users.join(0)).page;
  // At laptop width the views cover the editor's left margin, where the float
  // buttons are — the cost `floating-view.md` records. At desktop width the
  // editor's column sits clear of them.
  await page.setViewportSize({ width: 1920, height: 1080 });
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

  await float("line 0");
  // `MAIN_ID` in `ui.tsx`.
  const main = (await page.locator("#workspace-main").boundingBox())!;
  const first = (await view("line 0").boundingBox())!;
  expect(first.x - main.x).toBeCloseTo(24, 0);
  expect(first.y - main.y).toBeCloseTo(24, 0);

  for (let index = 1; index < 5; index++) await float(`line ${index}`);
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

test("selected blocks float together in one window, and a deleted one leaves its place marked", async ({ users }) => {
  const page = (await users.join(0)).page;
  await page.setViewportSize({ width: 1920, height: 1080 });
  const name = `e2e group ${Date.now()}`;
  await openDocument(page, await createDocument(page, name));
  await firstBlock(page).focus();
  for (let index = 0; index < 3; index++) {
    if (index > 0) await page.keyboard.press("Enter");
    await page.keyboard.insertText(`line ${index}`);
  }
  const rows = await blockValues(page);
  const idOf = (text: string) => rows.find((entry) => entry.text === text)!.id;
  const row = (text: string) => page.locator(`[data-block-id="${idOf(text)}"]`);

  await row("line 0").locator("textarea").click();
  await row("line 1").locator("textarea").click({ modifiers: ["Shift"] });
  await expect(page.locator("[data-block-id][data-selected]")).toHaveCount(2);
  await row("line 1").hover();
  await row("line 1").getByRole("button", { name: "선택한 블록을 플로팅 뷰로 열기" }).click();

  const view = page.getByRole("region", { name: `플로팅 뷰: ${name}` });
  await expect(view).toHaveCount(1);
  await expect(view).toContainText("line 0");
  await expect(view).toContainText("line 1");
  await expect(view).not.toContainText("line 2");

  // Backspace at the start of "line 1" merges it into "line 0", removing its block.
  await page.keyboard.press("Escape");
  await selectRange(page, idOf("line 1"), 0);
  await page.keyboard.press("Backspace");
  await expect(view).toContainText("line 0line 1");
  await expect(view).toContainText("원본 블록이 삭제되었습니다.");
});
