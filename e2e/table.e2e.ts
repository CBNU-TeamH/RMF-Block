import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { createDocument, firstBlock, openDocument } from "./helpers";
import { yorkieCut } from "./network";

const table = (page: Page) => page.locator("[data-table-block]");
const cell = (page: Page, row = 1, column = 1) => table(page).getByRole("textbox", { name: `${row}행 ${column}열`, exact: true });
const values = (page: Page) => table(page).locator("textarea").evaluateAll((nodes) => nodes.map((el) => (el as HTMLTextAreaElement).value));
async function insertTable(page: Page) {
  await firstBlock(page).fill("/table");
  await firstBlock(page).press("Enter");
  await expect(cell(page)).toBeFocused();
  await expect(table(page).getByRole("row")).toHaveCount(3);
}
// Controls appear on hover; Playwright's click hovers first, so a grip menu is two plain clicks.
async function axisMenu(page: Page, axis: "행" | "열", n: number, item: string) {
  await table(page).getByRole("button", { name: `${n}${axis} 메뉴`, exact: true }).click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
}
async function insertAt(page: Page, text: string, offset: number) {
  await cell(page).focus();
  await cell(page).evaluate((el, at) => (el as HTMLTextAreaElement).setSelectionRange(at, at), offset);
  await page.keyboard.insertText(text);
}

test("table commands, navigation, axis edits and reload preserve text", async ({ users }) => {
  const a = (await users.join(0)).page;
  const document = await createDocument(a, `table controls ${Date.now()}`);
  await openDocument(a, document);
  await insertTable(a);
  await cell(a).fill("Header");
  await cell(a).press("Tab");
  await expect(cell(a, 1, 2)).toBeFocused();
  await cell(a, 1, 2).press("Shift+Tab");
  await expect(cell(a)).toBeFocused();
  await cell(a, 3, 3).focus();
  await a.keyboard.insertText("body");
  await a.keyboard.press("Enter");
  await a.keyboard.insertText("next");
  await cell(a, 3, 3).press("Tab");
  await expect(cell(a, 4, 1)).toBeFocused();
  await axisMenu(a, "열", 1, "오른쪽에 열 추가");
  await expect(cell(a, 4, 2)).toBeFocused();
  await axisMenu(a, "열", 2, "열 삭제");
  await axisMenu(a, "행", 4, "행 삭제");
  await expect(table(a).getByRole("row")).toHaveCount(3);
  await expect(cell(a, 3, 3)).toHaveValue("body\nnext");
  await a.reload();
  await expect(cell(a)).toHaveValue("Header");
  await expect(cell(a, 3, 3)).toHaveValue("body\nnext");
  await a.locator("[data-block-id]").last().locator("textarea").fill("after table");
  await expect(table(a)).toBeVisible();
});

test("same-cell edits, separate-cell edits, undo/redo and IME converge", async ({ users }) => {
  const a = (await users.join(0)).page;
  const b = (await users.join(1)).page;
  const probes = [await yorkieCut(a), await yorkieCut(b)];
  const document = await createDocument(a, `table collaboration ${Date.now()}`);
  await openDocument(a, document);
  await insertTable(a);
  await cell(a).fill("abc");
  await openDocument(b, document);
  await expect(cell(b)).toHaveValue("abc");
  await Promise.all(probes.map((p) => p.ready()));
  await Promise.all(probes.map((p) => p.disconnect()));
  await insertAt(a, "A", 0);
  await insertAt(b, "B", 0);
  await cell(a, 2, 1).fill("left");
  await cell(b, 2, 2).fill("right");
  await Promise.all(probes.map((p) => p.restore()));
  await expect.poll(async () => {
    const text = await cell(a).inputValue();
    return text === await cell(b).inputValue() && /^[AB]{2}abc$/.test(text) && new Set(text.slice(0, 2)).size === 2;
  }).toBe(true);
  await expect(cell(a, 2, 2)).toHaveValue("right");
  await expect(cell(b, 2, 1)).toHaveValue("left");
  const previous = await cell(a).inputValue();
  await insertAt(a, "undo", previous.length);
  await expect(cell(b)).toHaveValue(`${previous}undo`);
  await cell(a).press("Control+z");
  await expect(cell(a)).toHaveValue(previous);
  await expect(cell(b)).toHaveValue(previous);
  await cell(a).press("Control+Shift+z");
  await expect(cell(b)).toHaveValue(`${previous}undo`);

  await cell(a).fill("aaa");
  await expect(cell(b)).toHaveValue("aaa");
  await cell(a).evaluate((el) => (el as HTMLTextAreaElement).setSelectionRange(1, 1));
  const base = await cell(a).inputValue();
  const ime = await a.context().newCDPSession(a);
  await ime.send("Input.imeSetComposition", { text: "안", selectionStart: 1, selectionEnd: 1 });
  // A final-string diff cannot place a character inside a run of the same one, so b's
  // insert is committed at the end (offset 3) and a's composition keeps its offset 1.
  // The remote-offset mapping itself is pinned by the component tests.
  await insertAt(b, "a", 0);
  await expect(cell(b)).toHaveValue(`${base}a`);
  await expect(cell(a)).toHaveValue("a안aa");
  // A late reader verifies the edit has passed through the server before IME commits.
  const watcher = (await users.join(2)).page;
  await openDocument(watcher, document);
  await expect(cell(watcher)).toHaveValue(`${base}a`);
  await ime.send("Input.insertText", { text: "안" });
  await expect(cell(a)).toHaveValue("a안aaa");
  await expect(cell(b)).toHaveValue("a안aaa");
});

test("concurrent row/column creation, first intersection edits and deletion/input races converge", async ({ users }) => {
  const a = (await users.join(0)).page;
  const b = (await users.join(1)).page;
  const probes = [await yorkieCut(a), await yorkieCut(b)];
  const document = await createDocument(a, `table structure ${Date.now()}`);
  await openDocument(a, document);
  await insertTable(a);
  await openDocument(b, document);
  await expect(table(b).getByRole("row")).toHaveCount(3);
  const concurrent = async (edit: () => Promise<void>) => {
    await Promise.all(probes.map((p) => p.ready()));
    await Promise.all(probes.map((p) => p.disconnect()));
    await edit();
    await Promise.all(probes.map((p) => p.restore()));
  };
  await concurrent(async () => {
    await cell(a, 3, 1).focus();
    await axisMenu(a, "행", 3, "아래에 행 추가");
    await cell(b, 1, 3).focus();
    await axisMenu(b, "열", 3, "오른쪽에 열 추가");
  });
  await expect(table(a).locator("textarea")).toHaveCount(16);
  await expect(table(b).locator("textarea")).toHaveCount(16);
  await concurrent(async () => {
    await cell(a, 4, 4).fill("A");
    await cell(b, 4, 4).fill("B");
  });
  await expect.poll(async () => {
    const av = await cell(a, 4, 4).inputValue();
    return av === await cell(b, 4, 4).inputValue() && (av === "AB" || av === "BA");
  }).toBe(true);
  await cell(a, 4, 4).fill("joined");
  await expect(cell(b, 4, 4)).toHaveValue("joined");
  await concurrent(async () => {
    await cell(a, 4, 4).focus();
    await axisMenu(a, "행", 4, "행 삭제");
    await cell(b, 4, 4).fill("deleted-cell-input");
  });
  await expect(table(a).locator("textarea")).toHaveCount(12);
  await expect(table(b).locator("textarea")).toHaveCount(12);
  await expect.poll(() => values(a)).toEqual(await values(b));
  expect(await values(a)).not.toContain("deleted-cell-input");
  await expect(cell(b)).toBeFocused();
  await cell(a, 3, 1).focus();
  await axisMenu(a, "행", 3, "행 삭제");
  await expect(table(b).getByRole("row")).toHaveCount(2);
  await concurrent(async () => {
    await cell(a, 1, 1).focus();
    await axisMenu(a, "행", 1, "행 삭제");
    await cell(b, 2, 1).focus();
    await axisMenu(b, "행", 2, "행 삭제");
  });
  await expect(table(a).getByRole("row")).toHaveCount(1);
  await expect(table(b).getByRole("row")).toHaveCount(1);
  // Each side first sees only the row it kept; wait until both settle on the same fallback row.
  const firstRow = (page: Page) => table(page).locator("tr").first().getAttribute("data-table-row-id");
  await expect.poll(async () => (await firstRow(a)) === (await firstRow(b))).toBe(true);
  await expect.poll(() => values(a)).toEqual(await values(b));
  await cell(a).fill("fallback kept");
  await expect(cell(b)).toHaveValue("fallback kept");
  await axisMenu(a, "행", 1, "아래에 행 추가");
  await expect(table(a).getByRole("row")).toHaveCount(2);
  await expect(table(b).getByRole("row")).toHaveCount(2);
  await expect(cell(a)).toHaveValue("fallback kept");
  await expect(cell(b)).toHaveValue("fallback kept");
});

test("hover reveals the boundary and end buttons, and the table can be deleted", async ({ users }) => {
  const a = (await users.join(0)).page;
  const document = await createDocument(a, `table hover ${Date.now()}`);
  await openDocument(a, document);
  await insertTable(a);
  const addColumn = table(a).getByRole("button", { name: "오른쪽 끝에 열 추가" });
  await cell(a).evaluate((el) => (el as HTMLTextAreaElement).blur());
  await a.mouse.move(0, 0);
  await expect(addColumn).toHaveCSS("opacity", "0");
  await cell(a, 2, 2).hover();
  await expect(addColumn).toHaveCSS("opacity", "1");
  await addColumn.click();
  await expect(table(a).locator("textarea")).toHaveCount(12);
  await table(a).getByRole("button", { name: "아래쪽 끝에 행 추가" }).click();
  await expect(table(a).locator("textarea")).toHaveCount(16);
  await table(a).getByRole("button", { name: "2행 앞에 행 추가" }).click();
  await expect(table(a).locator("textarea")).toHaveCount(20);
  await table(a).getByRole("button", { name: "표 삭제" }).click();
  await table(a).getByRole("button", { name: "삭제", exact: true }).click();
  await expect(table(a)).toHaveCount(0);
});

test("named revision preview and restore preserve table cells and dimensions", async ({ users }) => {
  const a = (await users.join(0)).page;
  const b = (await users.join(1)).page;
  const document = await createDocument(a, `table revision ${Date.now()}`);
  await openDocument(a, document);
  await insertTable(a);
  await cell(a).fill("Saved header");
  await cell(a, 2, 2).fill("보존 [표]");
  await openDocument(b, document);
  await expect(cell(b, 2, 2)).toHaveValue("보존 [표]");
  await a.getByRole("button", { name: "버전 히스토리", exact: true }).click();
  const history = a.getByRole("region", { name: "버전 히스토리", exact: true });
  await history.getByRole("button", { name: "수동 저장", exact: true }).click();
  const prompt = a.getByRole("dialog").filter({ has: a.getByPlaceholder("예: 제출 전 최종") });
  await prompt.getByPlaceholder("예: 제출 전 최종").fill("table saved");
  await prompt.getByRole("button", { name: "저장", exact: true }).click();
  await history.getByRole("button", { name: /table saved/ }).click();
  await expect(history.getByRole("table")).toContainText("보존 [표]");
  await a.getByRole("button", { name: "버전 히스토리 닫기" }).click();
  await cell(a, 2, 2).fill("changed");
  await axisMenu(a, "행", 2, "아래에 행 추가");
  await a.getByRole("button", { name: "버전 히스토리", exact: true }).click();
  await history.getByRole("button", { name: /table saved/ }).click();
  await history.getByRole("button", { name: "이 버전으로 복원", exact: true }).click();
  await a.getByRole("dialog").filter({ hasText: "이 버전으로 복원할까요?" }).getByRole("button", { name: "복원", exact: true }).click();
  await a.getByRole("button", { name: "버전 히스토리 닫기" }).click();
  await expect(cell(a, 2, 2)).toHaveValue("보존 [표]");
  await expect(cell(b, 2, 2)).toHaveValue("보존 [표]");
  await expect(table(a).getByRole("row")).toHaveCount(3);
  await b.reload();
  await expect(cell(b)).toHaveValue("Saved header");
});
