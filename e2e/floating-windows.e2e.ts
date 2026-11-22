import type { Locator, Page } from "@playwright/test";

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

/** `STORAGE_KEY` in `lib/floating/views.ts`. */
const SAVED_VIEWS = "rmf-floating-views";
/** `HEADER` in `lib/floating/views.ts`: the title bar's height. */
const TITLE_BAR = 36;
/** `BAR_HEIGHT` in `lib/chat/window-frame.ts`: the strip at the bottom no window may cover. */
const BOTTOM_BAR = 40;

/** A document holding one line, its block floated from the editor. */
async function floatedLine(page: Page, name: string, text: string) {
  const documentId = await createDocument(page, name);
  await openDocument(page, documentId);
  await firstBlock(page).focus();
  await page.keyboard.insertText(text);
  const blockId = (await blockValues(page))[0]!.id;
  const row = page.locator(`[data-block-id="${blockId}"]`);
  await row.hover();
  await row.getByRole("button", { name: "플로팅 뷰로 열기" }).click();
  const view = page.getByRole("region", { name: `플로팅 뷰: ${name}` });
  await expect(view).toContainText(text);
  return { documentId, blockId, view };
}

/** The window's box once it has stopped changing — it fits itself to its content after opening. */
async function settled(view: Locator) {
  let last = "";
  for (;;) {
    const box = (await view.boundingBox())!;
    const now = JSON.stringify(box);
    if (now === last) return box;
    last = now;
    await view.page().waitForTimeout(200);
  }
}

const ratioOf = (box: { width: number; height: number }) => (box.height - TITLE_BAR) / box.width;

/**
 * STC-070-003: the corner grip scales a floating view without changing its shape, down to its
 * minimum width and no further than the window; a window that shrinks pulls the view back inside.
 */
test("a floating view scales by its corner keeping its ratio, within its minimum and the window (FR-070-02)", async ({ users }) => {
  const page = (await users.join(0)).page;
  await page.setViewportSize({ width: 1280, height: 900 });
  const { view } = await floatedLine(page, `e2e ratio ${Date.now()}`, "비율을 지키는 창");
  const start = await settled(view);
  const ratio = ratioOf(start);

  const drag = async (dx: number, dy: number) => {
    const grip = (await view.locator(".cursor-nwse-resize").boundingBox())!;
    const [x, y] = [grip.x + grip.width / 2, grip.y + grip.height / 2];
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 8 });
    await page.mouse.up();
    return settled(view);
  };

  const grown = await drag(150, 0);
  expect(grown.width).toBeCloseTo(start.width + 150, 0);
  expect(ratioOf(grown)).toBeCloseTo(ratio, 2);

  // `MIN_CONTENT_WIDTH`: narrower than 120 px and nothing stays readable.
  const smallest = await drag(-2000, -2000);
  expect(smallest.width).toBeCloseTo(Math.min(120, start.width), 0);
  expect(ratioOf(smallest)).toBeCloseTo(ratio, 2);

  const largest = await drag(5000, 5000);
  expect(largest.x + largest.width).toBeLessThanOrEqual(1280 + 1);
  expect(largest.y + largest.height).toBeLessThanOrEqual(900 - BOTTOM_BAR + 1);
  expect(ratioOf(largest)).toBeCloseTo(ratio, 2);

  await page.setViewportSize({ width: 700, height: 500 });
  await expect.poll(async () => {
    const box = await settled(view);
    return box.x >= 0 && box.x + box.width <= 700 + 1 && box.y + box.height <= 500 - BOTTOM_BAR + 1;
  }).toBe(true);
  expect(ratioOf(await settled(view))).toBeCloseTo(ratio, 2);
});

/**
 * STC-070-004: the saved list lives in `localStorage`, where anything can be written. On reload only
 * the whole entries come back — one each — and a list that is not JSON at all opens no window and
 * breaks nothing.
 */
test("a damaged saved window list restores only its whole entries (FR-070-03)", async ({ users }) => {
  const page = (await users.join(0)).page;
  const name = `e2e saved ${Date.now()}`;
  const { documentId, blockId } = await floatedLine(page, name, "살아남는 창");
  const frame = { x: 40, y: 40, width: 320, height: 220 };
  const whole = { documentId, blockId, frame };
  await page.evaluate(([key, list]) => window.localStorage.setItem(key, JSON.stringify(list)), [SAVED_VIEWS, [
    whole,
    null,
    "junk",
    { documentId, blockId, frame: { ...frame, x: "40" } },
    { documentId: 7, blockId, frame },
    { documentId, blockId, frame: { ...frame, width: 0 } },
    { fileId: "f", fileName: "half.png", frame },
    whole,
  ]] as const);
  await page.reload();
  const views = page.getByRole("region", { name: /^플로팅 뷰: / });
  await expect(views).toHaveCount(1);
  await expect(views).toContainText("살아남는 창");

  await page.evaluate((key) => window.localStorage.setItem(key, "{not json"), SAVED_VIEWS);
  await page.reload();
  await expect(firstBlock(page)).toBeVisible();
  await expect(views).toHaveCount(0);
});

/**
 * STC-070-005: a restored view whose document is not in the catalogue says the document was deleted
 * — once the catalogue has answered. While it has not, the view does not claim that.
 */
test("a restored view of a deleted document says so once the catalogue answers, and not before (FR-070-05)", async ({ users }) => {
  const page = (await users.join(0)).page;
  const name = `e2e gone ${Date.now()}`;
  const { documentId } = await floatedLine(page, name, "곧 지워질 문서");
  await page.goto("/");
  const removed = await page.request.delete(`/api/documents/${documentId}`);
  expect(removed.ok(), await removed.text()).toBe(true);
  const deleted = page.getByText("원본 문서가 삭제되었습니다.");

  // The catalogue never answers: the view cannot know, so it does not say — checked once it has asked.
  let asked = 0;
  await page.route("**/api/documents", () => void (asked += 1));
  await page.reload();
  const view = page.getByRole("region", { name: /^플로팅 뷰: / });
  await expect(view).toHaveCount(1);
  await expect.poll(() => asked).toBeGreaterThan(0);
  await expect(deleted).toHaveCount(0);
  await expect(page.getByRole("region", { name: "플로팅 뷰: 삭제된 문서" })).toHaveCount(0);

  await page.unroute("**/api/documents");
  await page.reload();
  await expect(page.getByRole("region", { name: "플로팅 뷰: 삭제된 문서" })).toBeVisible();
  await expect(deleted).toBeVisible();
});

/**
 * STC-070-006: a floating view stays open when its document moves in the tree, and shows an edit
 * someone else makes to the original as it happens.
 */
test("a floating view survives its document moving and shows edits to the original live (FR-070-03, FR-070-04)", async ({ users }) => {
  const page = (await users.join(0)).page;
  const editor = (await users.join(1)).page;
  const stamp = Date.now();
  const name = `e2e moved ${stamp}`;
  const { documentId, blockId, view } = await floatedLine(page, name, "원래 내용");
  await page.goto("/");
  await expect(view).toContainText("원래 내용");

  const parentName = `e2e new parent ${stamp}`;
  const parent = await createDocument(page, parentName);
  const moved = await page.request.patch(`/api/documents/${documentId}`, { data: { parentId: parent } });
  expect(moved.ok(), await moved.text()).toBe(true);
  // The sidebar hears of the move from the same socket message the floating views do.
  const parentRow = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: parentName, exact: true }) });
  await expect(parentRow.getByRole("button", { name: /^(접기|펼치기)$/ })).toBeVisible();
  await expect(view).toHaveCount(1);
  await expect(view).toContainText("원래 내용");

  await openDocument(editor, documentId);
  await selectRange(editor, blockId, 0, "원래 내용".length);
  await editor.keyboard.type("고친 내용");
  await expect(view).toContainText("고친 내용");
  await expect(view).not.toContainText("원래 내용");
});
