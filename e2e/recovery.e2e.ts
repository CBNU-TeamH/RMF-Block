import { setTimeout as holdOutage } from "node:timers/promises";

import { expect, test } from "./fixtures";
import { block, blockValues, chatRow, createDocument, firstBlockId, insertAt, online, openChat, openDocument, sendChat } from "./helpers";
import { YORKIE_SERVICE, networkProbe } from "./network";

test("activated clients retain both sides' edits and backfill chat once after a 20-second outage", { tag: "@slow" }, async ({ users }) => {
  test.setTimeout(120_000);
  const a = (await users.join(0)).page;
  const b = (await users.join(1)).page;
  const probe = await networkProbe(b, "chat");
  const document = await createDocument(a, `e2e recovery ${Date.now()}`);
  await openDocument(a, document);
  await openDocument(b, document);
  await online(a, 2);
  const id = await firstBlockId(a);
  await insertAt(a, id, 0, "base");
  await expect(block(b, id)).toHaveValue("base");
  await openChat(a);
  await openChat(b);
  await probe.ready();
  const before = `e2e-before-${Date.now()}`;
  await sendChat(a, before);
  await expect(chatRow(b, before)).toHaveCount(1);
  await probe.disconnect(true);
  const outage = holdOutage(20_000); // Required outage duration, not a wait for convergence.
  const missed = [`e2e-missed-one-${Date.now()}`, `e2e-missed-two-${Date.now()}`];
  await insertAt(a, id, 4, "[online]");
  await insertAt(b, id, 0, "[offline]");
  await expect(block(b, id)).toHaveValue("[offline]base");
  await sendChat(a, missed[0]);
  await sendChat(a, missed[1]);
  await expect(chatRow(a, missed[1])).toHaveCount(1);
  await expect(chatRow(b, missed[0])).toHaveCount(0);
  await outage;
  try {
    await probe.restore();
    await expect(block(a, id)).toHaveValue("[offline]base[online]", { timeout: 60_000 });
    await expect(block(b, id)).toHaveValue("[offline]base[online]", { timeout: 60_000 });
    await expect.poll(() => blockValues(b)).toEqual(await blockValues(a));
    for (const text of [before, ...missed]) {
      await expect(chatRow(b, text)).toHaveCount(1);
      await expect(chatRow(b, text)).toContainText(users.name(0));
    }
    const after = `e2e-after-${Date.now()}`;
    await sendChat(b, after);
    await expect(chatRow(a, after)).toHaveCount(1);
    await expect(chatRow(a, after)).toContainText(users.name(1));
    for (const text of [before, ...missed]) await expect(chatRow(b, text)).toHaveCount(1);
  } finally {
    await probe.restore();
  }
});

// Expected failures until #37 (`docs/testing.md`, "Network evidence").
const knownDefect = { annotation: { type: "issue", description: "https://github.com/CBNU-TeamH/RMF-Block/issues/37" } };

test.fail("diagnostic: initial Yorkie failure recovers without reloading", knownDefect, async ({ users }) => {
  test.setTimeout(120_000);
  const page = (await users.join(0)).page;
  const yorkie = (url: URL) => url.pathname.includes(YORKIE_SERVICE);
  await page.route(yorkie, (route) => route.abort("internetdisconnected"));
  await page.goto("/");
  await expect(page.getByRole("banner")).toContainText("연결 끊김");
  await page.unroute(yorkie);
  await online(page, 1);
});

test.fail("diagnostic: the session notification socket reconnects and delivers takeover", knownDefect, async ({ users }) => {
  test.setTimeout(120_000);
  const a = await users.join(0);
  const c = await users.join(2);
  const probe = await networkProbe(a.page, "workspace");
  await a.page.goto("/");
  await c.page.goto("/");
  await online(a.page, 2);
  await probe.ready();
  const opens = await probe.opens();
  await probe.disconnect(false);
  await probe.restore();
  await users.join(0);
  expect((await a.page.request.get("/api/documents")).status()).toBe(401);
  await expect.poll(() => probe.opens()).toBeGreaterThan(opens);
  await expect(a.page).toHaveURL(/\/join$/);
  expect((await c.page.request.get("/api/documents")).status()).toBe(200);
});
