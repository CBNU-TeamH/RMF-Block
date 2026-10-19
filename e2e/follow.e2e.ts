import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { blockValues, createDocument, firstBlock, online, openDocument } from "./helpers";

const scroller = (page: Page) => page.locator("[data-focus-scroll]");

/** How far block `id` sits below the top of the page's scroll container, in px. */
function offsetOf(page: Page, id: string): Promise<number> {
  return scroller(page).evaluate((box, blockId) => {
    const row = box.querySelector(`[data-block-id="${blockId}"]`)!;
    return row.getBoundingClientRect().top - box.getBoundingClientRect().top;
  }, id);
}

/** Puts block `id` at the top, as `e2e/perf/round.perf.ts`'s presenter does. */
function scrollToTop(page: Page, id: string): Promise<void> {
  return scroller(page).evaluate((box, blockId) => {
    const row = box.querySelector(`[data-block-id="${blockId}"]`)!;
    box.scrollTop += row.getBoundingClientRect().top - box.getBoundingClientRect().top;
  }, id);
}

/** `scrollTop` once a wheel's own smooth scroll has come to rest. */
async function restingScrollTop(page: Page): Promise<number> {
  let last = Number.NaN;
  for (;;) {
    const now = await scroller(page).evaluate((box) => box.scrollTop);
    if (now === last) return now;
    last = now;
    await page.waitForTimeout(250);
  }
}

/**
 * UC-030 E3-1 and E3-3: a follower's own scroll pauses the follow rather than
 * being pulled back, 재개 brings them to where the presenter is now, and the end
 * of the share is announced.
 */
test("a follower's own scroll pauses the follow, 재개 brings them back, and the end is announced", async ({ users }) => {
  test.setTimeout(90_000);
  const lead = (await users.join(0)).page;
  const follower = (await users.join(1)).page;
  const document = await createDocument(lead, `e2e follow ${Date.now()}`);

  await openDocument(lead, document);
  await firstBlock(lead).focus();
  for (let index = 0; index < 40; index++) {
    await lead.keyboard.insertText(`line ${index}`);
    await lead.keyboard.press("Enter");
  }
  const blocks = await blockValues(lead);
  await openDocument(follower, document);
  await expect.poll(async () => (await blockValues(follower)).length).toBe(blocks.length);
  await online(lead, 2);
  await online(follower, 2);

  await scrollToTop(lead, blocks[0].id);
  await lead.getByRole("button", { name: "공유하기", exact: true }).click();
  await follower.getByRole("button", { name: /공유 중 · 참여하기/ }).click();
  await expect(follower.getByRole("button", { name: /따라가는 중 · 종료/ })).toBeVisible();

  await scroller(follower).hover();
  await follower.mouse.wheel(0, 400);
  const resume = follower.getByRole("button", { name: /일시 정지됨 · 재개/ });
  await expect(resume).toBeVisible();
  const own = await restingScrollTop(follower);

  // While paused the presenter's move must not reach this view. Nothing happens
  // to wait for, so the wait is a fixed span: well past one publish (100ms) and
  // a smooth scroll.
  const target = blocks[30].id;
  await scrollToTop(lead, target);
  await follower.waitForTimeout(1500);
  expect(Math.abs((await restingScrollTop(follower)) - own)).toBeLessThanOrEqual(1);

  await resume.click();
  await expect(follower.getByRole("button", { name: /따라가는 중 · 종료/ })).toBeVisible();
  await expect.poll(async () => Math.abs(await offsetOf(follower, target))).toBeLessThanOrEqual(8);

  await lead.getByRole("button", { name: "공유 종료", exact: true }).click();
  await expect(follower.getByRole("status").filter({ hasText: "공유가 종료되었습니다" })).toBeVisible();
  await expect(follower.getByRole("button", { name: /따라가는 중|일시 정지됨/ })).toHaveCount(0);
});
