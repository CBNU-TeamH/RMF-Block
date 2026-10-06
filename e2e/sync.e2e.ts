import { expect, test } from "@playwright/test";

import { createDocument, firstBlock, joinedPage, nickname, openDocument } from "./helpers";

test("an edit in one browser shows in the other", async ({ browser }) => {
  const a = await joinedPage(browser, nickname("sync-a"));
  const b = await joinedPage(browser, nickname("sync-b"));
  const id = await createDocument(a, `e2e sync ${Date.now()}`);
  await openDocument(a, id);
  await openDocument(b, id);

  await firstBlock(a).click();
  await a.keyboard.type("hello from a");

  await expect(firstBlock(b)).toHaveValue("hello from a");
});
