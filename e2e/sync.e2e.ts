import { expect, test } from "./fixtures";

import { block, createDocument, firstBlockId, openDocument } from "./helpers";

test("an edit in one browser shows in the other", async ({ users }) => {
  const a = (await users.join(0)).page;
  const b = (await users.join(1)).page;
  const id = await createDocument(a, `e2e sync ${Date.now()}`);
  await openDocument(a, id);
  await openDocument(b, id);
  const blockId = await firstBlockId(a);

  await block(a, blockId).click();
  await a.keyboard.type("hello from a");

  await expect(block(b, blockId)).toHaveValue("hello from a");
});
