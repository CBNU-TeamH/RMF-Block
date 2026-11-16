import { expect, test } from "./fixtures";
import { block, blockValues, createDocument, firstBlock, openDocument, selectRange } from "./helpers";

test("a user jumps from the tree to a colleague's document and block, comes back, and loses the jump when they leave (FR-040-01~04)", async ({ users }) => {
  const me = await users.join(0);
  const colleague = await users.join(1);
  const mine = await createDocument(me.page, `e2e here ${Date.now()}`);
  const theirs = await createDocument(me.page, `e2e there ${Date.now()}`);

  // Long enough that a block far down starts below the fold: landing in the viewport then means the jump targeted it.
  await openDocument(colleague.page, theirs);
  await firstBlock(colleague.page).focus();
  for (let index = 0; index < 30; index++) {
    await colleague.page.keyboard.insertText(`line ${index}`);
    await colleague.page.keyboard.press("Enter");
  }
  const target = (await blockValues(colleague.page)).find((row) => row.text === "line 25")!;
  await selectRange(colleague.page, target.id, "line 25".length);

  await openDocument(me.page, mine);
  const jump = me.page.getByRole("complementary").getByRole("button", { name: `${colleague.name}에게 이동` });
  await jump.click();
  await expect(me.page).toHaveURL(new RegExp(`/documents/${theirs}$`));
  await expect(block(me.page, target.id)).toHaveValue("line 25");
  await expect(me.page.locator(`[data-block-id="${target.id}"]`)).toBeInViewport();

  await me.page.getByRole("banner").getByRole("button", { name: "돌아가기" }).click();
  await expect(me.page).toHaveURL(new RegExp(`/documents/${mine}$`));

  await colleague.page.close();
  await expect(jump).toHaveCount(0);
  await expect(me.page.getByRole("banner")).toContainText(`${colleague.name} · 오프라인`);
});
