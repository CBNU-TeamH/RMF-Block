import { expect, test } from "./fixtures";

import { block, createDocument, firstBlockId, openDocument } from "./helpers";

/**
 * #52: a peer's edit that lands while a Hangul composition is open. A composes
 * 안 at the end of `abc` through the Chrome DevTools Protocol — the same
 * `compositionstart` / `compositionend` a Korean IME produces — while B types X
 * at the start of the same block. Both screens must end on the same text.
 */
test("a remote edit during an IME composition leaves both screens agreeing", async ({
  users,
}) => {
  const a = (await users.join(0)).page;
  const b = (await users.join(1)).page;
  const watcher = (await users.join(2)).page;
  const id = await createDocument(a, `e2e ime ${Date.now()}`);
  await openDocument(a, id);
  await openDocument(b, id);
  await openDocument(watcher, id);
  const blockId = await firstBlockId(a);

  await block(a, blockId).click();
  await a.keyboard.type("abc");
  await expect(block(b, blockId)).toHaveValue("abc");

  const ime = await a.context().newCDPSession(a);
  await ime.send("Input.imeSetComposition", { text: "안", selectionStart: 1, selectionEnd: 1 });
  await expect(block(a, blockId)).toHaveValue("abc안");

  await block(b, blockId).click();
  await b.keyboard.press("Home");
  await b.keyboard.type("X");
  // B's edit is queued behind A's open composition, so nothing on A's screen
  // shows it. A third client that is not composing does: once it has the edit,
  // the same broadcast has reached A.
  await expect(block(watcher, blockId)).toHaveValue("Xabc");

  await ime.send("Input.insertText", { text: "안" });

  await expect.poll(async () => [await block(a, blockId).inputValue(), await block(b, blockId).inputValue()])
    .toEqual(["Xabc안", "Xabc안"]);
});
