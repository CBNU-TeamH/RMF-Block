import { expect, test } from "./fixtures";
import { createDocument, online, openDocument } from "./helpers";

test("documents open as tabs that reorder, close and are landed on; only the active one is joined", async ({ users }) => {
  const a = await users.join(0);
  const b = (await users.join(1)).page;
  const page = a.page;
  const first = `e2e tab one ${Date.now()}`;
  const second = `e2e tab two ${Date.now()}`;
  const firstId = await createDocument(page, first);
  const secondId = await createDocument(page, second);
  const tabs = page.getByRole("navigation", { name: "열린 문서" });
  const names = () => tabs.getByRole("link").allInnerTexts();

  await openDocument(page, firstId);
  await expect(tabs.getByRole("link")).toHaveText([first]);
  // The last tab cannot close.
  await expect(tabs.getByRole("button")).toHaveCount(0);

  await page.getByRole("complementary").locator(`a[href="/documents/${secondId}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/documents/${secondId}$`));
  await expect(tabs.getByRole("link")).toHaveText([first, second]);
  await expect(tabs.getByRole("link", { name: second })).toHaveAttribute("aria-current", "page");

  // Joined only where the active tab is: the peer sees one dot, on the second.
  await openDocument(b, secondId);
  await online(b, 2);
  const tree = b.getByRole("complementary");
  const dot = { name: `${a.name}에게 이동` };
  await expect(tree.getByRole("button", dot)).toHaveCount(1);
  await expect(tree.locator("li").filter({ hasText: second }).getByRole("button", dot)).toHaveCount(1);
  await tabs.getByRole("link", { name: first }).click();
  await expect(page).toHaveURL(new RegExp(`/documents/${firstId}$`));
  await expect(tree.locator("li").filter({ hasText: first }).getByRole("button", dot)).toHaveCount(1);
  await expect(tree.getByRole("button", dot)).toHaveCount(1);

  // Dropped on the left half of the first tab = before it.
  await tabs.getByRole("listitem").nth(1).dragTo(tabs.getByRole("listitem").nth(0), { targetPosition: { x: 4, y: 8 } });
  await expect(tabs.getByRole("link")).toHaveText([second, first]);
  await page.reload();
  await expect(tabs.getByRole("link")).toHaveText([second, first]);

  expect((await page.request.patch(`/api/documents/${secondId}`, { data: { name: `${second} renamed` } })).ok()).toBe(true);
  await expect(tabs.getByRole("link")).toHaveText([`${second} renamed`, first]);

  // The active tab was last, so closing it lands on its left neighbour.
  await tabs.getByRole("button", { name: `${first} 닫기` }).click();
  await expect(page).toHaveURL(new RegExp(`/documents/${secondId}$`));
  expect(await names()).toEqual([`${second} renamed`]);

  await page.goto("/");
  await expect(page).toHaveURL(new RegExp(`/documents/${secondId}$`));
});
