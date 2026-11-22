import { expect, test } from "./fixtures";
import { createDocument, openChat } from "./helpers";

/**
 * STC-060-002: a message with no text and nothing attached is refused, and so is text past 2000
 * characters — by the server, which is the rule, and by the send button for what it can see.
 */
test("a blank message and one past 2000 characters are refused (FR-060-01)", async ({ users }) => {
  const { context, page } = await users.join(0);
  const api = context.request;

  for (const text of ["", "   \n\t "]) {
    const refused = await api.post("/api/chat", { data: { text } });
    expect(refused.status(), JSON.stringify(text)).toBe(400);
    expect(await refused.json()).toEqual({ error: "메시지나 첨부 파일 중 하나는 있어야 합니다." });
  }
  const tooLong = await api.post("/api/chat", { data: { text: "가".repeat(2001) } });
  expect(tooLong.status()).toBe(400);
  const longest = await api.post("/api/chat", { data: { text: `${"가".repeat(1990)}${Date.now()}`.slice(0, 2000) } });
  expect(longest.status(), await longest.text()).toBe(201);

  await page.goto("/");
  await openChat(page);
  const chat = page.getByRole("region", { name: "채팅" });
  const field = chat.getByRole("textbox", { name: "채팅 메시지" });
  const send = chat.getByRole("button", { name: "전송", exact: true });
  await expect(send).toBeDisabled();
  await field.fill("   ");
  await expect(send).toBeDisabled();

  // Past the limit the server refuses it, and the message stays on screen to resend (UC-060 E1-1).
  const over = `${Date.now()} ${"나".repeat(2001)}`;
  await field.fill(over);
  await send.click();
  await expect(chat.getByRole("button", { name: /전송 실패 · 다시 보내기/ })).toBeVisible();
});

/**
 * STC-060-007: a link to a document that has since been deleted keeps the name it was sent with,
 * dimmed, says the document is gone, and cannot be followed.
 */
test("a chat link to a deleted document shows its old name and cannot be opened (FR-060-03)", async ({ users }) => {
  const { context, page } = await users.join(0);
  const api = context.request;
  const name = `e2e linked ${Date.now()}`;
  const documentId = await createDocument(page, name);
  const sent = await api.post("/api/chat", { data: { link: { documentId } } });
  expect(sent.status(), await sent.text()).toBe(201);
  expect((await api.delete(`/api/documents/${documentId}`)).ok()).toBe(true);

  await page.goto("/");
  await openChat(page);
  const card = page.getByRole("region", { name: "채팅" }).getByRole("button", { name: new RegExp(`${name}\\s*삭제된 문서`) });
  await expect(card).toBeVisible();
  await expect(card).toBeDisabled();
  await expect(card).toHaveCSS("opacity", "0.6");
});
