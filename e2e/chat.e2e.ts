import { expect, test } from "./fixtures";
import { chatRow, online, openChat, sendChat } from "./helpers";

test("UI messages arrive once in both directions with the correct sender", async ({ users }) => {
  const a = await users.join(0);
  const b = await users.join(1);
  await a.page.goto("/");
  await b.page.goto("/");
  await online(a.page, 2);
  await openChat(a.page);
  await openChat(b.page);
  const left = `e2e chat A ${Date.now()}`;
  const right = `e2e chat B ${Date.now()}`;
  await sendChat(a.page, left);
  await expect(chatRow(b.page, left)).toHaveCount(1);
  await expect(chatRow(b.page, left)).toContainText(a.name);
  await sendChat(b.page, right);
  for (const page of [a.page, b.page]) {
    await expect(chatRow(page, left)).toHaveCount(1);
    await expect(chatRow(page, right)).toHaveCount(1);
    await expect(chatRow(page, right)).toContainText(b.name);
  }
});
