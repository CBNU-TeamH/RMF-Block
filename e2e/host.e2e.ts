import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { createDocument, online } from "./helpers";

// Bootstrap URLs and the resulting role cookie contain the host secret.
// Disable traces for both directions rather than recording and redacting archives.
test.use({ trace: "off" });

async function bootstrapHost(page: Page): Promise<void> {
  const secret = process.env.E2E_HOST_SECRET;
  if (!secret) throw new Error("Set E2E_HOST_SECRET from this stack's startup banner, or use pnpm e2e:isolated.");
  await page.goto("/join");
  // Browser-side navigation keeps the credential out of Playwright step titles.
  await page.evaluate((credential) => {
    window.location.assign(`/api/auth/host?secret=${encodeURIComponent(credential)}`);
  }, secret);
  await expect(page.getByRole("complementary").getByRole("textbox", { name: "문서 제목 검색" })).toBeVisible();
}

test("a valid bootstrap grants host and strips the secret from the address", async ({ page, context }) => {
  await bootstrapHost(page);
  await expect(page.getByRole("banner")).toContainText("Host (나)");
  expect(new URL(page.url()).search).toBe("");
  expect((await context.cookies()).map((cookie) => cookie.name)).toContain("role");
  await page.getByRole("complementary").getByRole("link", { name: "관리자" }).click();
  await expect(page).toHaveURL(/\/admin$/);
});

test("a wrong bootstrap cannot grant host", async ({ page, context }) => {
  await page.goto("/api/auth/host?secret=invalid-e2e-bootstrap");
  await expect(page).toHaveURL(/\/join$/);
  expect((await context.cookies()).map((cookie) => cookie.name)).not.toContain("role");
  expect((await page.request.get("/api/documents")).status()).toBe(401);
});

test("the host restores a deleted document from /admin, and a guest's tree shows it without reload", async ({ page, users }) => {
  const guest = (await users.join(0)).page;
  const name = `e2e trash ${Date.now()}`;
  const id = await createDocument(guest, name);
  expect((await guest.request.delete(`/api/documents/${id}`)).ok()).toBe(true);
  await guest.goto("/");
  await online(guest, 1);
  const peerLink = guest.getByRole("complementary").locator(`a[href="/documents/${id}"]`);
  await expect(peerLink).toHaveCount(0);
  // A full navigation would hide a dead notification socket by reseeding the tree.
  const timeOrigin = await guest.evaluate(() => performance.timeOrigin);

  await bootstrapHost(page);
  await page.goto("/admin");
  const row = page.getByRole("region", { name: "휴지통" }).getByRole("listitem").filter({ hasText: name });
  await row.getByRole("button", { name: "복원" }).click();

  await expect(peerLink).toHaveText(name);
  await expect(row).toHaveCount(0);
  expect(await guest.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
});
