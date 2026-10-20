import { expect, test } from "./fixtures";
import { blockValues, createDocument, firstBlock, openChat, openDocument } from "./helpers";

/**
 * FR-060-01/03/06: a block sent to chat from its ··· menu opens at that block
 * for someone else, and a URL typed beside it opens in a new tab.
 */
test("a block sent to chat opens at that block for someone else, and a URL in it opens in a new tab", async ({ users }) => {
  test.setTimeout(90_000);
  const a = (await users.join(0)).page;
  const b = (await users.join(1)).page;
  const name = `e2e links ${Date.now()}`;
  const document = await createDocument(a, name);

  await openDocument(a, document);
  await firstBlock(a).focus();
  for (let index = 0; index < 30; index++) {
    await a.keyboard.insertText(`line ${index}`);
    await a.keyboard.press("Enter");
  }
  const target = (await blockValues(a)).find((row) => row.text === "line 25")!;
  const row = a.locator(`[data-block-id="${target.id}"]`);
  await row.hover();
  await row.getByRole("button", { name: "블록 메뉴" }).click();
  await a.getByRole("menuitem", { name: "채팅으로 보내기" }).click();

  const chat = a.getByRole("region", { name: "채팅" });
  await expect(chat.getByText(`${name} › line 25`)).toBeVisible();
  await chat.getByRole("textbox", { name: "채팅 메시지" }).fill("여기 보세요 https://example.com/spec.");
  await chat.getByRole("button", { name: "전송", exact: true }).click();

  await b.goto("/");
  await openChat(b);
  const theirs = b.getByRole("region", { name: "채팅" });
  await expect(theirs.getByRole("link", { name: "https://example.com/spec" }).last()).toHaveAttribute("target", "_blank");
  await theirs.getByRole("button", { name: new RegExp(`${name}\\s*line 25`) }).last().click();

  await expect(b).toHaveURL(new RegExp(`/documents/${document}$`));
  await expect(b.locator(`[data-block-id="${target.id}"]`)).toBeInViewport();
});
