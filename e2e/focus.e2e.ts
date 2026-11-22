import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { block, blockValues, createDocument, dotColour, firstBlock, online, openDocument } from "./helpers";
import { watchSync } from "./network";

function share(page: Page) {
  return page.getByRole("button", { name: "공유하기", exact: true });
}

function following(page: Page) {
  return page.getByRole("button", { name: /님을 따라가는 중 · 종료/ });
}

function paused(page: Page) {
  return page.getByRole("button", { name: /따라가기 일시 정지됨 · 재개/ });
}

/** Opens a document from the sidebar, a client-side move like a person's click — not `goto`. */
async function openFromSidebar(page: Page, name: string): Promise<void> {
  await page.getByRole("complementary").getByRole("link", { name, exact: true }).click();
}

/** A document of a few lines, so there is something to scroll and draw on. */
async function documentOfLines(page: Page, name: string): Promise<string> {
  const id = await createDocument(page, name);
  await openDocument(page, id);
  await firstBlock(page).focus();
  for (let index = 0; index < 6; index++) {
    await page.keyboard.insertText(`${name} 줄 ${index}`);
    await page.keyboard.press("Enter");
  }
  return id;
}

/** How many ink segments `page` draws in `colour` — marks are SVG polylines (`ink-overlay.tsx`). */
function inkIn(page: Page, colour: string): Promise<number> {
  return page.locator("[data-focus-scroll] svg polyline").evaluateAll(
    (lines, wanted) => lines.filter((line) => getComputedStyle(line).stroke === wanted).length,
    colour,
  );
}

/** The sidebar dot that shows `who` in document `name` on `page` — how the test knows a move reached it. */
function dotIn(page: Page, name: string, who: string) {
  return page.getByRole("listitem")
    .filter({ has: page.getByRole("link", { name, exact: true }) })
    .getByRole("button", { name: `${who}에게 이동`, exact: true });
}

/** Drags a highlight across the first block, as a presenter with the 형광펜 tool does. */
async function highlightFirstBlock(page: Page): Promise<void> {
  await page.getByRole("button", { name: "형광펜", exact: true }).click();
  const box = (await page.locator("[data-block-id]").first().boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 10, y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step++) await page.mouse.move(box.x + 10 + step * 20, y);
  await page.mouse.up();
}

/**
 * STC-030-004 and 030-005: the presenter moving to another document takes the follower along; the
 * follower opening one themselves pauses the follow instead. Ending a paused follow takes the
 * follower out without telling them the share ended, because it has not — the presenter goes on.
 */
test("the follower follows the presenter to another document, pauses on its own move, and leaves quietly (FR-030-07, FR-030-09)", async ({ users }) => {
  test.setTimeout(90_000);
  const presenter = await users.join(0);
  const lead = presenter.page;
  const follower = (await users.join(1)).page;
  const stamp = Date.now();
  const first = `e2e focus first ${stamp}`;
  const second = `e2e focus second ${stamp}`;
  const third = `e2e focus third ${stamp}`;
  const firstId = await documentOfLines(lead, first);
  const secondId = await createDocument(lead, second);
  await createDocument(lead, third);
  await openDocument(lead, firstId);
  await openDocument(follower, firstId);
  await online(lead, 2);

  await share(lead).click();
  await follower.getByRole("button", { name: /님의 공유에 참여하기/ }).click();
  await expect(following(follower)).toBeVisible();

  await openFromSidebar(lead, second);
  await expect(lead).toHaveURL(new RegExp(`/documents/${secondId}$`));
  await expect(follower).toHaveURL(new RegExp(`/documents/${secondId}$`));
  await expect(following(follower)).toBeVisible();

  await openFromSidebar(follower, first);
  await expect(follower).toHaveURL(new RegExp(`/documents/${firstId}$`));
  await expect(paused(follower)).toBeVisible();
  // Paused, so the presenter's next move does not pull the follower back.
  await openFromSidebar(lead, third);
  await expect(dotIn(follower, third, presenter.name)).toBeVisible();
  await expect(follower).toHaveURL(new RegExp(`/documents/${firstId}$`));
  await expect(paused(follower)).toBeVisible();

  await follower.getByRole("button", { name: "종료", exact: true }).click();
  await expect(paused(follower)).toHaveCount(0);
  await expect(following(follower)).toHaveCount(0);
  // The share goes on: the presenter still shares, the follower may join again, and nobody told
  // the follower it ended. The presenter moves once more so the follower has heard from it since.
  await openFromSidebar(lead, second);
  await expect(dotIn(follower, second, presenter.name)).toBeVisible();
  await expect(follower).toHaveURL(new RegExp(`/documents/${firstId}$`));
  await expect(follower.getByRole("button", { name: /님이 공유 중 · 참여하기/ })).toBeVisible();
  await expect(follower.getByRole("status").filter({ hasText: "공유가 종료되었습니다" })).toHaveCount(0);
  await expect(lead.getByRole("button", { name: "공유 종료", exact: true })).toBeVisible();
});

/**
 * STC-030-010, 030-009 and 030-011 with three people. 공유하기 is offered only while nobody else
 * shares — not beside one presenter, nor beside two. Two presenters at once is the state two
 * clicks that cross produce; the second presenter's sync is held while pressing it, so it has not
 * seen the first. A follower draws only the presenter it follows, and that presenter's
 * marks leave its screen when the share ends.
 */
test("공유하기 shows only while nobody shares, a follower sees only its presenter's marks, and they go when the share ends (FR-030-03, FR-030-12~14)", async ({ users }) => {
  test.setTimeout(120_000);
  const lead = await users.join(0);
  const other = await users.join(1);
  const watcher = await users.join(2);
  const [a, b, c] = [lead.page, other.page, watcher.page];
  const holdSync = watchSync(b);
  const id = await documentOfLines(a, `e2e ink ${Date.now()}`);
  await openDocument(b, id);
  await openDocument(c, id);
  await online(c, 3);
  const [aColour, bColour] = [await dotColour(c, lead.name), await dotColour(c, other.name)];
  expect(aColour).not.toBe(bColour);

  // Nobody shares: offered.
  await expect(share(c)).toBeVisible();

  // One shares: not offered, and the share is announced.
  const release = await holdSync();
  await share(a).click();
  await expect(c.getByRole("button", { name: `${lead.name}님의 공유에 참여하기` })).toBeVisible();
  await expect(share(c)).toHaveCount(0);

  // b has not seen a's share, so still offers it; pressing it makes two presenters. c is told of
  // the second share too, which is how this test knows c holds both — and still offers nothing.
  await expect(share(b)).toBeVisible();
  await share(b).click();
  await release();
  await expect(c.getByRole("button", { name: `${other.name}님의 공유에 참여하기` })).toBeVisible();
  await expect(share(c)).toHaveCount(0);

  // c joins from the header, which names one of the two; that one is the presenter it follows.
  await c.getByRole("button", { name: /님이 공유 중 · 참여하기/ }).click();
  await expect(following(c)).toBeVisible();
  const followsLead = (await following(c).innerText()).includes(lead.name);
  const [followed, ignored] = followsLead ? [a, b] : [b, a];
  const ignoredName = followsLead ? other.name : lead.name;
  const [followedColour, ignoredColour] = followsLead ? [aColour, bColour] : [bColour, aColour];

  // Both draw; c draws the marks of the one it follows and not the other's.
  // The ignored presenter's marks reach c without showing, so it then takes a block, which does
  // show: a later write from the same presence, so once c shows it, c holds the marks too.
  await highlightFirstBlock(followed);
  await highlightFirstBlock(ignored);
  const taken = (await blockValues(ignored))[2]!.id;
  await block(ignored, taken).focus();
  await expect(c.locator(`[data-block-id="${taken}"]`).getByText(ignoredName, { exact: true })).toHaveCount(1);
  expect(await inkIn(c, ignoredColour)).toBe(0);
  await expect.poll(() => inkIn(c, followedColour)).toBeGreaterThan(0);

  // The followed presenter ends the share: its marks leave c's screen, and its own.
  await followed.getByRole("button", { name: "공유 종료", exact: true }).click();
  await expect.poll(() => inkIn(c, followedColour)).toBe(0);
  await expect.poll(() => inkIn(followed, followedColour)).toBe(0);
  await expect(c.getByRole("status").filter({ hasText: "공유가 종료되었습니다" })).toBeVisible();
});
