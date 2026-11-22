import { expect, password, test } from "./fixtures";
import { bootstrapHost } from "./helpers";

// The first test signs a page in as the host, and the role cookie carries the host secret.
test.use({ trace: "off" });

/**
 * FR-010-02 and FR-011-04 on a stack whose workspace is already open: setup is refused a second
 * time, a too-short password is refused, and neither changes the password guests join with. The
 * unopened half of both lives in `lifecycle/lifecycle.e2e.ts`, on a stack nobody has set up.
 */
test("an open workspace refuses a second setup and a too-short password, and keeps its password (FR-010-02, FR-011-04)", async ({ page, users }) => {
  await bootstrapHost(page);
  const other = `${password}-other`;

  const again = await page.request.post("/api/workspace", { data: { name: "e2e again", password: other } });
  expect(again.status(), await again.text()).toBe(409);
  expect(await again.json()).toEqual({ error: "이미 열린 워크스페이스입니다." });

  // The length rule is checked before "already open", so a short password says why it is refused.
  const shortSetup = await page.request.post("/api/workspace", { data: { name: "e2e again", password: "abc" } });
  expect(shortSetup.status()).toBe(400);
  const shortChange = await page.request.patch("/api/workspace/password", { data: { password: "abc" } });
  expect(shortChange.status()).toBe(400);
  expect(await shortChange.json()).toEqual({ error: "비밀번호는 4자 이상이어야 합니다." });

  // Nothing above took effect: the attempted password is turned away, the stack's still admits.
  const visitor = await users.visitor(0);
  const wrong = await visitor.context.request.post("/api/workspace/join", { data: { nickname: visitor.name, password: other } });
  expect(wrong.status()).toBe(401);
  await users.join(1);
});

/** FR-020-04: the join screen is for people who are not in yet. */
test("a member who opens the join screen is sent home (FR-020-04)", async ({ users }) => {
  const { page } = await users.join(0);
  await page.goto("/join");
  // `/` lands on a document unless the workspace has none (#168).
  await expect(page).toHaveURL(/\/(documents\/[^/]+)?$/);
  await expect(page.getByRole("complementary").getByRole("textbox", { name: "문서 제목 검색" })).toBeVisible();
});

/**
 * NFR-SEC-001: before the page hydrates the join form is a native form, which submits as a GET.
 * With scripts off that is every submit, so the fields must carry no `name`: a password typed there
 * would otherwise be in the address bar and the history.
 */
test("a join form submitted without scripts puts neither the password nor the nickname in any address (NFR-SEC-001)", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    const addresses: Array<string> = [];
    // Navigations only: those are what the address bar and the history keep. A subresource may carry
    // a query of its own — Edge asks for the favicon with a cache-busting one.
    page.on("request", (request) => {
      if (request.isNavigationRequest()) addresses.push(request.url());
    });
    await page.goto("/join");
    const nickname = `e2e-nojs-${Date.now()}`;
    const typed = `e2e-nojs-pw-${Date.now()}`;
    await page.getByLabel("닉네임").fill(nickname);
    await page.getByLabel("워크스페이스 비밀번호").fill(typed);
    const submitted = page.waitForEvent("framenavigated");
    await page.getByRole("button", { name: "입장", exact: true }).click();
    await submitted;
    await expect(page.getByLabel("닉네임")).toBeVisible();

    expect(addresses.length).toBeGreaterThan(1);
    for (const address of [...addresses, page.url()]) {
      expect(address).not.toContain(typed);
      expect(address).not.toContain(nickname);
      expect(new URL(address).search).toBe("");
    }
    // No session came of it: this was a submit that went nowhere.
    expect((await context.cookies()).map((cookie) => cookie.name)).not.toContain("workspace_session");
  } finally {
    await context.close();
  }
});
