import type { Page, Request } from "@playwright/test";

import { expect, test } from "./fixtures";
import { block, blockTexts, blockValues, createDocument, firstBlockId, openDocument, selectRange } from "./helpers";
import { YORKIE_SERVICE } from "./network";

function history(page: Page) {
  return page.getByRole("region", { name: "버전 히스토리", exact: true });
}

async function openHistory(page: Page) {
  await page.getByRole("button", { name: "버전 히스토리", exact: true }).click();
  await expect(history(page)).toBeVisible();
}

/** The 수동 저장 dialog: its name field and its 저장 button. */
function nameDialog(page: Page) {
  const dialog = page.getByRole("dialog").filter({ hasText: "지금 상태를 수동으로 저장할까요?" });
  return { dialog, field: dialog.getByRole("textbox"), save: dialog.getByRole("button", { name: "저장", exact: true }) };
}

async function saveVersion(page: Page, label: string): Promise<void> {
  await history(page).getByRole("button", { name: "수동 저장", exact: true }).click();
  const { dialog, field, save } = nameDialog(page);
  await field.fill(label);
  await save.click();
  await expect(dialog).toHaveCount(0);
  await expect(entry(page, label)).toBeVisible();
}

/** A row in the list, by the title it shows. */
function entry(page: Page, title: string) {
  return history(page).getByRole("button", { name: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) });
}

/** Replaces the whole text of block `id` the way a person does: select it, type over it. */
async function retype(page: Page, id: string, text: string): Promise<void> {
  const current = await block(page, id).inputValue();
  await selectRange(page, id, 0, current.length);
  await page.keyboard.type(text);
}

async function documentWith(page: Page, name: string, text: string): Promise<{ id: string; blockId: string }> {
  const id = await createDocument(page, name);
  await openDocument(page, id);
  const blockId = await firstBlockId(page);
  await block(page, blockId).focus();
  // Firefox's driver rejects an empty insert.
  if (text) await page.keyboard.insertText(text);
  return { id, blockId };
}

const DAY = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" });

/**
 * STC-090-001, 090-002, 090-004 and 090-006 on one document: the list is newest first under its
 * day, ends with the end marker, names each kind, refuses a name shaped like a reserved kind while
 * a near-match saves, and a version's preview has its text blocks in order. Paging past
 * `REVISION_PAGE_SIZE` (50) stays with the unit test (`revisions.test.mts`).
 */
test("the version list is newest first by day, names each kind, and refuses reserved names (FR-090-02~05, FR-090-07)", async ({ users }) => {
  test.setTimeout(120_000);
  const page = (await users.join(0)).page;
  const stamp = Date.now();
  const { blockId } = await documentWith(page, `e2e history ${stamp}`, "첫째");
  await page.keyboard.press("Enter");
  await page.keyboard.insertText("둘째");
  await page.keyboard.press("Enter");
  await page.keyboard.insertText("셋째");

  await openHistory(page);
  await expect(history(page).getByText("이름을 지정한 버전이 없습니다.")).toBeVisible();
  await saveVersion(page, `older ${stamp}`);
  await page.getByRole("button", { name: "버전 히스토리 닫기" }).click();
  await retype(page, blockId, "바꾼 첫째");
  await openHistory(page);
  await saveVersion(page, `newer ${stamp}`);

  // Reserved shapes are refused before anything is stored; a name that only resembles one is not.
  await history(page).getByRole("button", { name: "수동 저장", exact: true }).click();
  const { dialog, field, save } = nameDialog(page);
  await field.fill("snapshot-12");
  await expect(dialog.getByRole("alert")).toHaveText("`snapshot-숫자`는 자동 저장이 쓰는 이름입니다. 다른 이름을 지어 주세요.");
  await expect(save).toBeDisabled();
  await field.fill("before-restore:abc");
  await expect(dialog.getByRole("alert")).toHaveText("'before-restore:'로 시작하는 이름은 복원 기록이 쓰는 형식입니다.");
  await expect(save).toBeDisabled();
  await field.fill(`snapshot-12 메모 ${stamp}`);
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await save.click();
  await expect(entry(page, `snapshot-12 메모 ${stamp}`)).toBeVisible();

  // Newest first, under today's date, then the end marker.
  const titles = await history(page).getByRole("button", { name: new RegExp(` ${stamp}`) }).allInnerTexts();
  expect(titles.map((text) => text.split("\n")[0])).toEqual([`snapshot-12 메모 ${stamp}`, `newer ${stamp}`, `older ${stamp}`]);
  await expect(history(page).getByText(DAY.format(new Date()), { exact: true })).toBeVisible();
  await expect(history(page).getByText("가장 오래된 버전입니다.")).toBeVisible();
  for (const label of [`older ${stamp}`, `newer ${stamp}`, `snapshot-12 메모 ${stamp}`]) {
    await expect(entry(page, label)).toContainText("수동 저장");
  }

  // The older version's preview: its own text, its blocks in order, read-only.
  await entry(page, `older ${stamp}`).click();
  await expect(history(page)).toContainText(/첫째\s*둘째\s*셋째/);
  await expect(history(page)).not.toContainText("바꾼 첫째");
  await expect(history(page).locator("textarea")).toHaveCount(0);
});

/**
 * STC-090-006's automatic kind: Yorkie records a revision of its own at every snapshot, which this
 * stack takes every 500 changes (`docs/design/version-history.md`). The list hides those until
 * 자동 저장 포함 is ticked, and shows them as 자동 저장.
 */
test("Yorkie's own revisions show as 자동 저장 only when asked for (FR-090-03, FR-090-04)", async ({ users }) => {
  test.setTimeout(180_000);
  const page = (await users.join(0)).page;
  await documentWith(page, `e2e automatic ${Date.now()}`, "");
  // One change per keystroke: past the 500-change snapshot threshold.
  await page.keyboard.type("가".repeat(560));
  await expect.poll(async () => (await blockTexts(page))[0]?.length).toBe(560);

  await openHistory(page);
  const automatic = history(page).getByRole("button", { name: /^자동 저장/ });
  await expect(automatic).toHaveCount(0);
  await history(page).getByRole("checkbox", { name: "자동 저장 포함" }).check();
  await expect(async () => {
    await history(page).getByRole("button", { name: "새로고침", exact: true }).click();
    await expect(automatic.first()).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await expect(automatic.first()).toContainText(/^자동 저장.*· 자동 저장$/);
});

/**
 * STC-090-007: a restore first saves the document as it stands (복원 직전 상태), and the peer sees
 * the restored text. A restore that fails — here the revision fetch is cut — says so and leaves
 * the document, and the list, as they were.
 */
test("a restore saves the current state first and reaches the peer; a failed one changes nothing (FR-090-09~11, FR-090-13)", async ({ users }) => {
  test.setTimeout(120_000);
  const restorer = await users.join(0);
  const a = restorer.page;
  const b = (await users.join(1)).page;
  const stamp = Date.now();
  const { id, blockId } = await documentWith(a, `e2e restore ${stamp}`, "원래 문장");
  await openDocument(b, id);
  await expect(block(b, blockId)).toHaveValue("원래 문장");

  await openHistory(a);
  await saveVersion(a, `base ${stamp}`);
  await a.getByRole("button", { name: "버전 히스토리 닫기" }).click();
  await retype(a, blockId, "바뀐 문장");
  await expect(block(b, blockId)).toHaveValue("바뀐 문장");

  await openHistory(a);
  await entry(a, `base ${stamp}`).click();
  await history(a).getByRole("button", { name: "이 버전으로 복원", exact: true }).click();
  await a.getByRole("dialog").filter({ hasText: "이 버전으로 복원할까요?" }).getByRole("button", { name: "복원", exact: true }).click();
  await expect(entry(a, "복원 직전 상태")).toHaveCount(1);
  await expect(entry(a, "복원 직전 상태")).toContainText("복원 전");
  // FR-090-11: both the named version and the one the restore wrote carry who did it.
  for (const title of [`base ${stamp}`, "복원 직전 상태"]) await expect(entry(a, title)).toContainText(`· ${restorer.name}`);
  await entry(a, "복원 직전 상태").click();
  await expect(history(a)).toContainText("바뀐 문장");
  await a.getByRole("button", { name: "버전 히스토리 닫기" }).click();
  await expect.poll(async () => (await blockTexts(b))[0]).toBe("원래 문장");
  await expect.poll(async () => (await blockTexts(a))[0]).toBe("원래 문장");

  // A failed restore: the revision cannot be fetched.
  const current = (await blockValues(a))[0]!.id;
  await retype(a, current, "두 번째 변경");
  await expect.poll(async () => (await blockTexts(b))[0]).toBe("두 번째 변경");
  await openHistory(a);
  await entry(a, `base ${stamp}`).click();
  await expect(history(a).getByRole("button", { name: "이 버전으로 복원", exact: true })).toBeEnabled();
  await a.route(`**${YORKIE_SERVICE}GetRevision`, (route) => route.abort());
  await history(a).getByRole("button", { name: "이 버전으로 복원", exact: true }).click();
  const confirm = a.getByRole("dialog").filter({ hasText: "이 버전으로 복원할까요?" });
  await confirm.getByRole("button", { name: "복원", exact: true }).click();
  await expect(history(a).getByRole("alert")).toHaveText("복원하지 못했습니다. 문서는 그대로입니다.");
  await confirm.getByRole("button", { name: "취소", exact: true }).click();
  await a.unroute(`**${YORKIE_SERVICE}GetRevision`);

  await history(a).getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(entry(a, `base ${stamp}`)).toBeVisible();
  await expect(entry(a, "복원 직전 상태")).toHaveCount(1);
  await a.getByRole("button", { name: "버전 히스토리 닫기" }).click();
  for (const page of [a, b]) {
    await expect.poll(async () => (await blockTexts(page))[0]).toBe("두 번째 변경");
  }
});

/**
 * STC-090-008: the revision calls go to Yorkie, so it is Yorkie that has to refuse them without a
 * session. The exact requests a member's browser sends — listing, saving and reading a version —
 * are replayed from outside the browser without its token, and with an invented one; each is
 * refused as unauthenticated, while the same request with the member's token is answered.
 */
test("Yorkie refuses the revision calls without a session's token (FR-090-12)", async ({ users, playwright }) => {
  const page = (await users.join(0)).page;
  const stamp = Date.now();
  await documentWith(page, `e2e revision auth ${stamp}`, "보호된 문장");

  const captured = new Map<string, Request>();
  page.on("request", (request) => {
    const method = request.url().split(YORKIE_SERVICE)[1];
    if (method && ["ListRevisions", "CreateRevision", "GetRevision"].includes(method)) captured.set(method, request);
  });
  await openHistory(page);
  await saveVersion(page, `kept ${stamp}`);
  await entry(page, `kept ${stamp}`).click();
  await expect(history(page)).toContainText("보호된 문장");
  expect([...captured.keys()].sort()).toEqual(["CreateRevision", "GetRevision", "ListRevisions"]);

  const outsider = await playwright.request.newContext();
  try {
    for (const [method, request] of captured) {
      const { authorization: token, ...rest } = await request.allHeaders();
      expect(token, `${method} carries the member's token`).toBeTruthy();
      const replay = (authorization?: string) =>
        outsider.post(request.url(), {
          headers: { ...rest, ...(authorization ? { authorization } : {}) },
          data: request.postDataBuffer() ?? Buffer.alloc(0),
        });
      for (const refused of [await replay(), await replay("made-up")]) {
        expect(refused.status(), `${method} without a session`).toBe(401);
      }
      // The control: the same bytes with the member's token are not refused. CreateRevision is not
      // replayed with it, so the test does not store a second version.
      if (method !== "CreateRevision") expect((await replay(token)).status(), `${method} with the token`).toBe(200);
    }
  } finally {
    await outsider.dispose();
  }
});
