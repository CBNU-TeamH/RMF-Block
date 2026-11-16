import { expect, password, test } from "./fixtures";
import { bootstrapHost, joinForm, online } from "./helpers";

test.use({ trace: "off" });

test("a guest or a visitor is turned away from the admin page and its APIs (FR-011-07)", async ({ request, users }) => {
  const guest = await users.join(0);
  await guest.page.goto("/admin");
  await expect(guest.page).toHaveURL(/\/(documents\/[^/]+)?$/);

  // The current password, so a wrongly accepted change would still leave the stack usable.
  const change = { data: { password } };
  const stranger = "00000000-0000-4000-8000-000000000000";
  // `request` carries no cookie: the visitor.
  for (const api of [guest.context.request, request]) {
    expect((await api.patch("/api/workspace/password", change)).status()).toBe(401);
    expect((await api.delete(`/api/workspace/members/${stranger}`)).status()).toBe(401);
  }
});

test.describe("a password change", () => {
  let changed = false;

  // Every later spec joins with the stack's password. A hook, not a `finally`: after a timeout the
  // test body keeps running while the fixtures close, but a hook still has `page` open.
  test.afterEach(async ({ page }) => {
    if (!changed) return;
    changed = false;
    expect((await page.request.patch("/api/workspace/password", { data: { password } })).status()).toBe(204);
  });

  test("keeps connected guests and admits only the new password (FR-011-04~06)", async ({ page, users }) => {
    const connected = await users.join(0);
    await connected.page.goto("/");
    await online(connected.page, 1);

    await bootstrapHost(page);
    await page.goto("/admin");
    const next = `e2e-pw-${Date.now()}`;
    await page.getByLabel("새 비밀번호").fill(next);
    changed = true;
    await page.getByRole("button", { name: "비밀번호 변경" }).click();
    await expect(page.getByRole("status")).toContainText("비밀번호를 바꿨습니다.");

    expect((await connected.context.request.get("/api/documents")).status()).toBe(200);

    const late = await users.visitor(1);
    await late.page.goto("/join");
    await joinForm(late.page, late.name, password!);
    await expect(late.page.locator("form").getByRole("alert")).toHaveText("비밀번호가 틀렸습니다.");
    await joinForm(late.page, late.name, next);
    await expect(late.page).toHaveURL(/\/(documents\/[^/]+)?$/);
  });
});

test("the host kicks a guest after confirming; only that guest leaves, is told why, and may rejoin (FR-011-01~03)", async ({ page, users }) => {
  const kicked = await users.join(0);
  const stays = await users.join(1);
  await kicked.page.goto("/");
  await stays.page.goto("/");

  await bootstrapHost(page);
  await page.goto("/admin");
  await online(stays.page, 2);

  const row = page.getByRole("listitem").filter({ hasText: kicked.name });
  const dialog = page.getByRole("dialog");
  await row.getByRole("button", { name: "퇴장" }).click();
  await expect(dialog).toContainText(`${kicked.name}님을 퇴장시킬까요?`);
  await dialog.getByRole("button", { name: "취소" }).click();
  await expect(dialog).toBeHidden();
  expect((await kicked.context.request.get("/api/documents")).status()).toBe(200);

  await row.getByRole("button", { name: "퇴장" }).click();
  await dialog.getByRole("button", { name: "퇴장" }).click();
  await expect(row).toHaveCount(0);

  await expect(kicked.page).toHaveURL(/\/join\?reason=kicked$/);
  await expect(kicked.page.getByRole("status")).toHaveText("워크스페이스에서 퇴장되었습니다.");
  expect((await kicked.context.request.get("/api/documents")).status()).toBe(401);

  await online(stays.page, 1);
  await expect(stays.page.getByRole("banner")).toContainText(`${kicked.name} · 오프라인`);
  expect((await stays.context.request.get("/api/documents")).status()).toBe(200);

  // UC-011 is not a ban: the same nickname and password get back in.
  await joinForm(kicked.page, kicked.name, password!);
  await expect(kicked.page).toHaveURL(/\/(documents\/[^/]+)?$/);
});
