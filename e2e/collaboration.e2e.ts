import { expect, test, type Users } from "./fixtures";
import { block, blockValues, createDocument, firstBlock, firstBlockId, insertAt, online, openDocument, selectRange } from "./helpers";
import { yorkieCut } from "./network";

type Probe = Awaited<ReturnType<typeof yorkieCut>>;

async function pair(users: Users, sever = false) {
  const a = (await users.join(0)).page;
  const b = (await users.join(1)).page;
  // Installed before navigation: the probe patches the page's `fetch`.
  const probes = sever ? [await yorkieCut(a), await yorkieCut(b)] : [];
  const document = await createDocument(a, `e2e collaboration ${Date.now()}`);
  await openDocument(a, document);
  await openDocument(b, document);
  await online(a, 2);
  const id = await firstBlockId(a);
  await expect(block(b, id)).toBeVisible();
  return { a, b, id, document, probes };
}

/** Run `edit` with every client cut off from Yorkie, so no edit can see
 *  another before it is made — `Promise.all` over pages alone does not
 *  guarantee that. */
async function concurrently(probes: Probe[], edit: () => Promise<void>) {
  await Promise.all(probes.map((probe) => probe.ready()));
  await Promise.all(probes.map((probe) => probe.disconnect()));
  await edit();
  await Promise.all(probes.map((probe) => probe.restore()));
}

test("edits go both ways and late/reloaded readers see the final content", async ({ users }) => {
  const { a, b, id, document } = await pair(users);
  await insertAt(a, id, 0, "alpha");
  await expect(block(b, id)).toHaveValue("alpha");
  await insertAt(b, id, 5, " beta");
  await expect(block(a, id)).toHaveValue("alpha beta");
  const late = (await users.join(2)).page;
  await openDocument(late, document);
  await expect(block(late, id)).toHaveValue("alpha beta");
  await b.reload();
  await expect(block(b, id)).toHaveValue("alpha beta");
});

test("concurrent inserts and independent range changes converge without duplicate input", async ({ users }) => {
  const { a, b, id, probes } = await pair(users, true);
  await insertAt(a, id, 0, "left middle right");
  await expect(block(b, id)).toHaveValue("left middle right");
  await concurrently(probes, async () => {
    await insertAt(a, id, 5, "[A]");
    await insertAt(b, id, 5, "[B]");
    // Each side holds only its own insert: the edits really were concurrent.
    await expect(block(a, id)).toHaveValue("left [A]middle right");
    await expect(block(b, id)).toHaveValue("left [B]middle right");
  });
  await expect.poll(async () => {
    const left = await block(a, id).inputValue();
    const right = await block(b, id).inputValue();
    return left === right && left.replace("[A]", "").replace("[B]", "") === "left middle right";
  }).toBe(true);
  const value = await block(a, id).inputValue();
  expect(value.split("[A]")).toHaveLength(2);
  expect(value.split("[B]")).toHaveLength(2);
  await concurrently(probes, async () => {
    await selectRange(a, id, 0, 4);
    await a.keyboard.insertText("LEFT");
    await selectRange(b, id, value.length - 5, value.length);
    await b.keyboard.insertText("RIGHT");
  });
  await expect(block(a, id)).toHaveValue(value.replace(/^left/, "LEFT").replace(/right$/, "RIGHT"));
  await expect(block(b, id)).toHaveValue(await block(a, id).inputValue());
});

test("Enter splits and Backspace merges in the same DOM order on the peer", async ({ users }) => {
  const { a, b, id } = await pair(users);
  await insertAt(a, id, 0, "headtail");
  await expect(block(b, id)).toHaveValue("headtail");
  await selectRange(a, id, 4);
  await a.keyboard.press("Enter");
  await expect.poll(async () => (await blockValues(a)).map((row) => row.text)).toEqual(["head", "tail", ""]);
  const split = await blockValues(a);
  await expect.poll(() => blockValues(b)).toEqual(split);
  await selectRange(a, split[1].id, 0);
  await a.keyboard.press("Backspace");
  await expect.poll(async () => (await blockValues(a)).map((row) => row.text)).toEqual(["headtail", ""]);
  await expect.poll(() => blockValues(b)).toEqual(await blockValues(a));
});

test("one user's undo and redo preserve another user's input", async ({ users }) => {
  const { a, b, id } = await pair(users);
  // Prepare text and its trailing empty block before the history operation under test.
  await insertAt(a, id, 0, "seed");
  await expect(block(b, id)).toHaveValue("seed");
  await insertAt(a, id, 4, "A");
  await expect(block(b, id)).toHaveValue("seedA");
  await insertAt(b, id, 5, "B");
  await expect(block(a, id)).toHaveValue("seedAB");
  await block(a, id).focus();
  await a.keyboard.press("Control+z");
  await expect(block(a, id)).toHaveValue("seedB");
  await expect(block(b, id)).toHaveValue("seedB");
  await a.keyboard.press("Control+Shift+z");
  await expect(block(a, id)).toHaveValue("seedAB");
  await expect(block(b, id)).toHaveValue("seedAB");
});

test("eight users preserve edits in separate blocks and single concurrent inserts in one block", async ({ users }) => {
  test.setTimeout(120_000);
  const first = (await users.join(0)).page;
  const probes = [await yorkieCut(first)];
  const document = await createDocument(first, `e2e eight ${Date.now()}`);
  await openDocument(first, document);
  // Seed before peers attach so initialization is not part of the concurrency case.
  await firstBlock(first).focus();
  for (let index = 0; index < 8; index++) {
    await first.keyboard.insertText(`seed${index}`);
    if (index < 7) await first.keyboard.press("Enter");
  }
  await expect(first.locator("[data-block-id] textarea")).toHaveCount(9);
  const seeds = await blockValues(first);
  const pages = [first];
  for (let slot = 1; slot < 8; slot++) {
    const page = (await users.join(slot)).page;
    probes.push(await yorkieCut(page));
    await openDocument(page, document);
    pages.push(page);
  }
  await Promise.all(pages.map((page) => online(page, 8)));
  await Promise.all(pages.map((page) => expect.poll(() => blockValues(page)).toEqual(seeds)));
  await Promise.all(pages.map((page, slot) => insertAt(page, seeds[slot].id, 5, `[${slot}]`)));
  const separate = seeds.map((row, slot) => ({ ...row, text: slot < 8 ? `seed${slot}[${slot}]` : "" }));
  await Promise.all(pages.map((page) => expect.poll(() => blockValues(page)).toEqual(separate)));
  const shared = seeds[0].id;
  await concurrently(probes, async () => {
    for (const [slot, page] of pages.entries()) await insertAt(page, shared, 0, `{${slot}}`);
  });
  await expect.poll(async () => {
    const values = await Promise.all(pages.map((page) => block(page, shared).inputValue()));
    return values.every((value) => value === values[0]) &&
      Array.from({ length: 8 }, (_, slot) => `{${slot}}`).every((token) => values[0].split(token).length === 2) &&
      values[0].replace(/\{[0-7]\}/g, "") === "seed0[0]";
  }, { timeout: 60_000 }).toBe(true);
  const final = await blockValues(first);
  await Promise.all(pages.map((page) => expect.poll(() => blockValues(page)).toEqual(final)));
});
