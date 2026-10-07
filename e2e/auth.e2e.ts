import type { Page } from "@playwright/test";

import { expect, password, test } from "./fixtures";
import { online } from "./helpers";

async function joinForm(page: Page, name: string, accessPassword: string) {
  await page.getByLabel("닉네임").fill(name);
  await page.getByLabel("워크스페이스 비밀번호").fill(accessPassword);
  await page.getByRole("button", { name: "입장", exact: true }).click();
}

test("visitor joins through the password gate and sees their identity and tree", async ({ users }) => {
  const { page, name } = await users.visitor(8);
  await page.goto("/");
  await expect(page).toHaveURL(/\/join$/);
  await joinForm(page, name, "wrong-workspace-password");
  // Scoped to the form: Next's route announcer is an `alert` too.
  await expect(page.locator("form").getByRole("alert")).toHaveText("비밀번호가 틀렸습니다.");
  await expect(page).toHaveURL(/\/join$/);
  expect(password, "E2E_WORKSPACE_PASSWORD must be configured").toBeTruthy();
  await joinForm(page, name, password!);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("complementary").getByRole("textbox", { name: "문서 제목 검색" })).toBeVisible();
  await expect(page.getByRole("banner")).toContainText(`${name} (나)`);
  await online(page, 1);
});

test("canceling takeover preserves the session; confirming displaces only that user", async ({ users }) => {
  const a = await users.join(0);
  const c = await users.join(2);
  await a.page.goto("/");
  await c.page.goto("/");
  await online(a.page, 2);
  const replacement = await users.visitor(0);
  await replacement.page.goto("/join");
  await joinForm(replacement.page, a.name, password!);
  const dialog = replacement.page.getByRole("dialog");
  await expect(dialog.getByRole("heading")).toHaveText("이미 사용 중인 이름입니다");
  await dialog.getByRole("button", { name: "다른 이름 쓰기" }).click();
  await expect(dialog).toHaveCount(0);
  await online(a.page, 2);
  const before = await a.page.request.get("/api/documents");
  expect(before.status()).toBe(200);
  await joinForm(replacement.page, a.name, password!);
  await dialog.getByRole("button", { name: "계속", exact: true }).click();
  await expect(a.page).toHaveURL(/\/join$/);
  await expect(replacement.page).toHaveURL(/\/$/);
  await online(c.page, 2);
  expect((await c.page.request.get("/api/documents")).status()).toBe(200);
  expect((await a.page.request.get("/api/documents")).status()).toBe(401);
});

test("two tabs of one session count once; peer arrival and departure update presence", async ({ users }) => {
  const a = await users.join(0);
  await a.page.goto("/");
  await online(a.page, 1);
  const tab = await users.tab(a);
  await tab.goto("/");
  await online(tab, 1);
  const b = await users.join(1);
  await b.page.goto("/");
  await online(a.page, 2);
  await online(tab, 2);
  await online(b.page, 2);
  await tab.close();
  await online(b.page, 2);
  await a.page.close();
  await online(b.page, 1);
  await expect(b.page.getByRole("banner")).toContainText(`${a.name} · 오프라인`);
});
