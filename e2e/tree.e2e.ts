import { expect, test } from "./fixtures";
import { createDocument, online } from "./helpers";

test("UI create, rename, move and delete update the peer's tree without reload", async ({ users }) => {
  const a = (await users.join(0)).page;
  const b = (await users.join(1)).page;
  const parentName = `e2e parent ${Date.now()}`;
  const parent = await createDocument(a, parentName);
  await a.goto("/");
  await b.goto("/");
  await online(a, 2);
  const aside = a.getByRole("complementary");
  const peer = b.getByRole("complementary");
  // A full navigation would hide a dead notification socket by reseeding the tree.
  const timeOrigin = await b.evaluate(() => performance.timeOrigin);
  const name = `e2e tree ${Date.now()}`;
  await aside.getByRole("button", { name: "새 문서", exact: true }).click();
  const dialog = a.getByRole("dialog");
  await dialog.getByLabel("문서 이름").fill(name);
  await dialog.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(a).toHaveURL(/\/documents\//);
  const id = new URL(a.url()).pathname.split("/").at(-1)!;
  const peerLink = peer.locator(`a[href="/documents/${id}"]`);
  await expect(peerLink).toHaveText(name);
  await aside.getByRole("button", { name: `${name} 메뉴` }).click();
  await a.getByRole("menuitem", { name: "이름 변경", exact: true }).click();
  const renamed = `${name} renamed`;
  await dialog.getByLabel("문서 이름").fill(renamed);
  await dialog.getByRole("button", { name: "이름 변경", exact: true }).click();
  await expect(peerLink).toHaveText(renamed);
  await aside.getByRole("button", { name: `${renamed} 메뉴` }).click();
  await a.getByRole("menuitem", { name: "이동", exact: true }).click();
  await dialog.getByLabel("옮길 위치").selectOption(parent);
  await dialog.getByRole("button", { name: "이동", exact: true }).click();
  // Nested = indented past its parent; the step size is the design's to change.
  const indent = (doc: string) =>
    peer.locator(`a[href="/documents/${doc}"]`).evaluate((link) => parseFloat(getComputedStyle(link).paddingLeft));
  await expect.poll(async () => (await indent(id)) - (await indent(parent))).toBeGreaterThan(0);
  const order = await peer.locator('a[href^="/documents/"]').evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(order.indexOf(`/documents/${id}`)).toBe(order.indexOf(`/documents/${parent}`) + 1);
  await aside.getByRole("button", { name: `${renamed} 메뉴` }).click();
  await a.getByRole("menuitem", { name: "삭제", exact: true }).click();
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  await expect(peerLink).toHaveText(renamed);
  await aside.getByRole("button", { name: `${renamed} 메뉴` }).click();
  await a.getByRole("menuitem", { name: "삭제", exact: true }).click();
  await dialog.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(peerLink).toHaveCount(0);
  await expect(peer.locator(`a[href="/documents/${parent}"]`)).toHaveText(parentName);
  expect(await b.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
});
