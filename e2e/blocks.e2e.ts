import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { block, blockTexts, blockValues, createDocument, dotColour, firstBlockId, openDocument, paste, selectRange } from "./helpers";

/** A document whose first blocks hold `lines`, one per block, opened on `page`. */
async function documentWith(page: Page, name: string, lines: Array<string>): Promise<string> {
  const id = await createDocument(page, name);
  await openDocument(page, id);
  await paste(page, await firstBlockId(page), lines.join("\n"));
  await expect.poll(async () => (await blockTexts(page)).slice(0, lines.length)).toEqual(lines);
  return id;
}

function row(page: Page, id: string) {
  return page.locator(`[data-block-id="${id}"]`);
}

/** The marker slot `editor.tsx` puts beside every text block: `•`, `1.`, a checkbox or nothing. */
function marker(page: Page, id: string) {
  return row(page, id).locator("> div > span").first();
}

/** The drag handle — the row's one `draggable` element. */
function handle(page: Page, id: string) {
  return row(page, id).locator("> span[draggable]");
}

/** Drags `id` by its handle onto the top edge of `targetId`, which lands it just before. */
async function dragBefore(page: Page, id: string, targetId: string): Promise<void> {
  await handle(page, id).dragTo(row(page, targetId), { targetPosition: { x: 40, y: 2 } });
}

async function order(page: Page, count: number): Promise<Array<string>> {
  return (await blockTexts(page)).slice(0, count);
}

/**
 * STC-022-002: a block's whole text being a marker converts it as it is typed, and the peer gets
 * the converted block, not the marker. Typed key by key, the way a person does — the paste path
 * is `markdown-paste.e2e.ts`'s.
 */
test("typing a Markdown marker converts the block, for everyone (FR-022-01)", async ({ users }) => {
  const a = (await users.join(0)).page;
  const b = (await users.join(1)).page;
  const id = await documentWith(a, `e2e shortcuts ${Date.now()}`, ["가", "나", "다", "라"]);
  const rows = (await blockValues(a)).slice(0, 4).map((entry) => entry.id);
  const typed = [
    ["# ", "제목"],
    ["- ", "항목"],
    ["> ", "인용"],
    ["1. ", "첫째"],
  ] as const;

  for (const [index, [markdown, text]] of typed.entries()) {
    await selectRange(a, rows[index]!, 0, 1);
    await a.keyboard.type(markdown);
    await a.keyboard.type(text);
  }

  await openDocument(b, id);
  for (const page of [a, b]) {
    await expect.poll(() => order(page, 4)).toEqual(["제목", "항목", "인용", "첫째"]);
    await expect(block(page, rows[0]!)).toHaveCSS("font-size", "30px");
    await expect(marker(page, rows[1]!)).toHaveText("•");
    await expect(block(page, rows[2]!)).toHaveCSS("border-left-width", "3px");
    await expect(marker(page, rows[3]!)).toHaveText("1.");
  }
});

/**
 * STC-022-005: a block moved by its handle moves for the peer too, and two people moving
 * different blocks at the same moment end with the same order, every block once.
 */
test("a block dragged by its handle moves for everyone, and two moves at once converge (FR-022-04)", async ({ users }) => {
  const a = (await users.join(0)).page;
  const b = (await users.join(1)).page;
  const lines = ["하나", "둘", "셋", "넷"];
  const id = await documentWith(a, `e2e reorder ${Date.now()}`, lines);
  await openDocument(b, id);
  const ids = Object.fromEntries((await blockValues(a)).slice(0, 4).map((entry) => [entry.text, entry.id]));

  await dragBefore(a, ids["셋"]!, ids["하나"]!);
  const moved = ["셋", "하나", "둘", "넷"];
  await expect.poll(() => order(a, 4)).toEqual(moved);
  await expect.poll(() => order(b, 4)).toEqual(moved);

  // At once: a takes 넷 to the top while b takes 하나 to just before 넷. Both moves survive the
  // merge and both screens agree on it. b places 하나 from its own view: after 둘 if a's move has
  // not reached it yet, at the very top if it has.
  // Whole lists of ids, so a duplicated or lost block, or a difference past these four, fails too.
  const rest = (await blockValues(a)).slice(4).map((entry) => entry.id);
  await Promise.all([dragBefore(a, ids["넷"]!, ids["셋"]!), dragBefore(b, ids["하나"]!, ids["넷"]!)]);
  const merged = [["넷", "셋", "둘", "하나"], ["하나", "넷", "셋", "둘"]].map((texts) => String([...texts.map((text) => ids[text]), ...rest]));
  const everyId = async (page: Page) => String((await blockValues(page)).map((entry) => entry.id));
  await expect
    .poll(async () => `${await everyId(a)} / ${await everyId(b)}`, { timeout: 15_000 })
    .toMatch(new RegExp(`^(${merged.join("|")}) / \\1$`));
});

/**
 * STC-022-012, STC-022-018 and STC-NFR-023 in one run, because each is a view of the same state:
 * someone's block shows their colour and name to the others, in the colour of their dot in the
 * header and not the viewer's own, and leaving the block lets the mark age out after the 30 s
 * heartbeat limit (`OCCUPANCY_TTL_MS`) rather than at once.
 */
test("an occupied block shows its occupant's colour and name to the others, and ages out after leaving (FR-022-06, NFR-USA-003)", async ({ users }) => {
  test.setTimeout(120_000);
  const first = await users.join(0);
  const second = await users.join(1);
  const [a, b] = [first.page, second.page];
  const id = await documentWith(a, `e2e occupancy ${Date.now()}`, ["위", "가운데", "아래"]);
  await openDocument(b, id);
  const target = (await blockValues(a)).find((entry) => entry.text === "가운데")!.id;

  const aColour = await dotColour(b, first.name);
  const bColour = await dotColour(a, second.name);
  expect(aColour).not.toBe(bColour);

  // Both in the same block: each sees the other there, in the other's colour.
  await block(a, target).click();
  await block(b, target).click();
  await expect(row(b, target)).toHaveCSS("border-top-color", aColour);
  await expect(row(b, target).getByText(first.name, { exact: true })).toHaveCount(1);
  await expect(row(a, target)).toHaveCSS("border-top-color", bColour);
  await expect(row(a, target).getByText(second.name, { exact: true })).toHaveCount(1);
  // Nobody is shown in the blocks nobody is in.
  const elsewhere = (await blockValues(b)).find((entry) => entry.text === "위")!.id;
  await expect(row(b, elsewhere)).not.toHaveCSS("border-top-width", "2px");

  // a leaves the block. Leaving publishes nothing, so the mark stays until the heartbeat is stale.
  await block(a, target).blur();
  const left = Date.now();
  await a.waitForTimeout(5_000);
  await expect(row(b, target).getByText(first.name, { exact: true })).toHaveCount(1);
  await expect(row(b, target).getByText(first.name, { exact: true })).toHaveCount(0, { timeout: 50_000 });
  const aged = Date.now() - left;
  // The last heartbeat may be up to one tick (5 s) before leaving, and the check runs every tick.
  expect(aged).toBeGreaterThan(20_000);
  expect(aged).toBeLessThan(45_000);
});

/**
 * STC-022-013: a block address pasted into an empty block becomes a block-link block that names
 * its document and goes to the block, says so once the document is gone, and is removed only
 * after a confirmation.
 */
test("a pasted block address becomes a link to that block, and a gone document shows as gone (SRS 4.1)", async ({ users }) => {
  const page = (await users.join(0)).page;
  const stamp = Date.now();
  const targetName = `e2e link target ${stamp}`;
  const targetId = await documentWith(page, targetName, ["첫 줄", "가리킬 줄"]);
  const pointed = (await blockValues(page)).find((entry) => entry.text === "가리킬 줄")!.id;
  const address = `${new URL(page.url()).origin}/documents/${targetId}#block=${pointed}`;

  const holder = await createDocument(page, `e2e link holder ${stamp}`);
  await openDocument(page, holder);
  await paste(page, await firstBlockId(page), address);
  const link = page.getByRole("button", { name: `${targetName} › 블록` });
  await expect(link).toBeVisible();
  const linkRow = page.locator("[data-block-id]").filter({ has: link });

  await link.click();
  await expect(page).toHaveURL(new RegExp(`/documents/${targetId}`));
  await expect(row(page, pointed)).toBeInViewport();

  // Off the target first: deleting the open document sends the app elsewhere, racing a navigation.
  await openDocument(page, holder);
  const removed = await page.request.delete(`/api/documents/${targetId}`);
  expect(removed.ok(), await removed.text()).toBe(true);
  await page.reload();
  await expect(page.getByText("삭제된 문서의 블록입니다.")).toBeVisible();
  await expect(link).toHaveCount(0);

  // Removing asks first: 취소 keeps it, 삭제 twice removes it.
  const gone = page.locator("[data-block-id]").filter({ hasText: "삭제된 문서의 블록입니다." });
  await gone.hover();
  await gone.getByRole("button", { name: "삭제", exact: true }).click();
  await gone.getByRole("button", { name: "취소", exact: true }).click();
  await expect(gone).toHaveCount(1);
  await gone.hover();
  await gone.getByRole("button", { name: "삭제", exact: true }).click();
  await gone.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(gone).toHaveCount(0);
  await expect(linkRow).toHaveCount(0);
});

/** STC-022-017: a PDF added from the editor becomes a PDF block showing that file. The image half is
 *  `file-manager.e2e.ts`'s. */
test("a PDF added from the editor becomes a PDF block (FR-022-13, FR-022-14)", async ({ users }) => {
  const page = (await users.join(0)).page;
  const fileName = `e2e-doc-${Date.now()}.pdf`;
  const id = await createDocument(page, `e2e pdf ${Date.now()}`);
  await openDocument(page, id);

  await page.locator("label").filter({ hasText: "파일 추가" }).locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"),
  });
  const frame = page.locator(`[data-block-id] iframe[title="${fileName}"]`);
  await expect(frame).toHaveCount(1);
  const preview = await frame.getAttribute("src");
  const served = await page.request.get(preview!);
  expect(served.status()).toBe(200);
  expect(served.headers()["content-type"]).toBe("application/pdf");
});
