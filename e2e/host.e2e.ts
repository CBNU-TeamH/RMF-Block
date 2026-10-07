import { test, expect } from "@playwright/test";

// Bootstrap URLs and the resulting role cookie contain the host secret.
// Disable traces for both directions rather than recording and redacting archives.
test.use({ trace: "off" });

test("a valid bootstrap grants host and strips the secret from the address", async ({ page, context }) => {
  const secret = process.env.E2E_HOST_SECRET;
  if (!secret) throw new Error("Set E2E_HOST_SECRET from this stack's startup banner, or use pnpm e2e:isolated.");
  await page.goto("/join");
  // Browser-side navigation keeps the credential out of Playwright step titles.
  await page.evaluate((credential) => {
    window.location.assign(`/api/auth/host?secret=${encodeURIComponent(credential)}`);
  }, secret);
  await expect(page.locator("aside").getByRole("textbox", { name: "문서 제목 검색" })).toBeVisible();
  await expect(page.locator("header")).toContainText("Host (나)");
  expect(new URL(page.url()).search === "").toBe(true);
  expect((await context.cookies()).some((cookie) => cookie.name === "role")).toBe(true);
});

test("a wrong bootstrap cannot grant host", async ({ page, context }) => {
  await page.goto("/api/auth/host?secret=invalid-e2e-bootstrap");
  await expect(page).toHaveURL(/\/join$/);
  expect((await context.cookies()).some((cookie) => cookie.name === "role")).toBe(false);
  expect((await page.request.get("/api/documents")).status()).toBe(401);
});
