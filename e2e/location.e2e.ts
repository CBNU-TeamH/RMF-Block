import { expect, test } from "./fixtures";
import { block, createDocument, firstBlockId, insertAt, openDocument } from "./helpers";

test("a user jumps from the tree to a colleague's document and block, comes back, and loses the jump when they leave (FR-040-01~04)", async ({ users }) => {
  const me = await users.join(0);
  const colleague = await users.join(1);
  const mine = await createDocument(me.page, `e2e here ${Date.now()}`);
  const theirs = await createDocument(me.page, `e2e there ${Date.now()}`);

  await openDocument(colleague.page, theirs);
  const id = await firstBlockId(colleague.page);
  await insertAt(colleague.page, id, 0, "colleague was here");

  await openDocument(me.page, mine);
  const jump = me.page.getByRole("complementary").getByRole("button", { name: `${colleague.name}에게 이동` });
  await jump.click();
  await expect(me.page).toHaveURL(new RegExp(`/documents/${theirs}$`));
  await expect(block(me.page, id)).toHaveValue("colleague was here");

  await me.page.getByRole("banner").getByRole("button", { name: "돌아가기" }).click();
  await expect(me.page).toHaveURL(new RegExp(`/documents/${mine}$`));

  await colleague.page.close();
  await expect(jump).toHaveCount(0);
  await expect(me.page.getByRole("banner")).toContainText(`${colleague.name} · 오프라인`);
});
