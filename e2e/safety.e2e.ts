import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { Page } from "@playwright/test";

import { expect, password, test } from "./fixtures";
import { block, chatRow, createDocument, firstBlockId, insertAt, online, openChat, openDocument, sendChat } from "./helpers";

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

/** Larger than one upload chunk, and not text: a corrupted or re-encoded byte shows in the hash. */
const BYTES = randomBytes(300_000);

async function downloaded(page: Page, click: () => Promise<void>): Promise<Buffer> {
  const pending = page.waitForEvent("download");
  await click();
  return readFile(await (await pending).path());
}

/**
 * NFR-SEC-003 in a browser: `lib/chat/links.ts` and React's escaping are unit-tested, this proves
 * what another user's screen does with the text. `x()` is the payloads' script: it only sets a flag,
 * so a run that executes one fails on the flag instead of on a dialog nobody dismissed.
 */
test("markup and script-shaped text stays inert on another user's screen (NFR-SEC-003)", async ({ users }) => {
  const image = "<img src=x onerror=x() data-xss>";
  // Kept literal on screen: a renderer that strips the element instead would show nothing.
  const payload = `${image}<script data-xss>x()</script>`;
  // The `e2e-` prefix is what the cleanup rules in `docs/testing.md` match members and chat lines by.
  const nickname = "e2e-<b data-xss=1>";
  const script = "javascript:x()";

  const dialogs: string[] = [];
  const watch = async (page: Page) => {
    await page.context().addInitScript(() => {
      (window as unknown as { x: () => void }).x = () => {
        (window as unknown as { xssRan: boolean }).xssRan = true;
      };
    });
    page.on("dialog", (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });
  };

  const author = await users.visitor(0);
  const reader = await users.join(1);
  await watch(author.page);
  await watch(reader.page);
  const join = await author.context.request.post("/api/workspace/join", {
    data: { nickname, password, force: true },
  });
  expect(join.ok(), await join.text()).toBe(true);

  const documentName = `e2e xss ${image} ${Date.now()}`;
  const document = await createDocument(author.page, documentName);
  await openDocument(author.page, document);
  const id = await firstBlockId(author.page);
  await insertAt(author.page, id, 0, payload);
  await openChat(author.page);
  // Unique per run: the stack keeps its chat history, so a repeated run would find the last one.
  const message = `${payload} ${script} ${Date.now()}`;
  await sendChat(author.page, message);

  await openDocument(reader.page, document);
  await online(reader.page, 2);
  await expect(block(reader.page, id)).toHaveValue(payload);
  await expect(reader.page.getByRole("complementary").getByRole("link", { name: documentName, exact: true })).toBeVisible();
  await expect(reader.page.getByRole("banner")).toContainText(nickname);
  await openChat(reader.page);
  await expect(chatRow(reader.page, message)).toHaveCount(1);
  await expect(chatRow(reader.page, message).getByRole("link")).toHaveCount(0);

  for (const page of [author.page, reader.page]) {
    await expect(page.locator("[data-xss]")).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { xssRan?: boolean }).xssRan)).toBeUndefined();
  }
  expect(dialogs).toEqual([]);
});

/**
 * NFR-REL-003: the bytes that go in are the bytes that come out, by the two routes a file takes —
 * a block in a document and a chat attachment. A hash, not a size: a re-encoded file keeps its length.
 */
test("a file put into a document or sent in chat downloads byte for byte (NFR-REL-003)", async ({ users }) => {
  const a = (await users.join(0)).page;
  const b = (await users.join(1)).page;
  const stamp = Date.now();
  const original = sha256(BYTES);

  const document = await createDocument(a, `e2e bytes ${stamp}`);
  await openDocument(a, document);
  const blockName = `e2e-bytes-${stamp}.bin`;
  await a
    .locator("label")
    .filter({ hasText: "파일 추가" })
    .locator('input[type="file"]')
    .setInputFiles({ name: blockName, mimeType: "application/octet-stream", buffer: BYTES });
  const row = a.locator("[data-block-id]").filter({ hasText: blockName });
  await expect(row).toBeVisible();
  expect(sha256(await downloaded(a, () => row.getByRole("link").click()))).toBe(original);

  await a.goto("/");
  await b.goto("/");
  await online(a, 2);
  await openChat(a);
  await openChat(b);
  const chatName = `e2e-chat-bytes-${stamp}.bin`;
  const sender = a.getByRole("region", { name: "채팅" });
  await sender.locator('input[type="file"]').setInputFiles({ name: chatName, mimeType: "application/octet-stream", buffer: BYTES });
  await sender.getByRole("button", { name: "전송", exact: true }).click();
  const attachment = b.getByRole("region", { name: "채팅" }).locator("li").filter({ hasText: chatName });
  await expect(attachment).toBeVisible();
  expect(sha256(await downloaded(b, () => attachment.getByRole("link").click()))).toBe(original);
});

/** NFR-SAF-002: `file-manager.e2e.ts` confirms a file block's deletion; this is the other branch. */
test("cancelling a file block's deletion keeps the file (NFR-SAF-002)", async ({ users }) => {
  const page = (await users.join(0)).page;
  const stamp = Date.now();
  const name = `e2e-keep-${stamp}.bin`;
  const kept = BYTES.subarray(0, 1024);
  const document = await createDocument(page, `e2e keep ${stamp}`);
  await openDocument(page, document);
  await page
    .locator("label")
    .filter({ hasText: "파일 추가" })
    .locator('input[type="file"]')
    .setInputFiles({ name, mimeType: "application/octet-stream", buffer: kept });
  const row = page.locator("[data-block-id]").filter({ hasText: name });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "삭제", exact: true }).click();
  await row.getByRole("button", { name: "취소", exact: true }).click();
  await expect(row.getByRole("button", { name: "취소", exact: true })).toHaveCount(0);
  await expect(row).toBeVisible();

  // Asked from the document first: a reload drops an edit the Yorkie client has not sent yet.
  await expect
    .poll(async () => {
      const { files } = (await (await page.request.get("/api/files")).json()) as { files: Array<{ name: string }> };
      return files.some((file) => file.name === name);
    })
    .toBe(true);
  await page.reload();
  const reloaded = page.locator("[data-block-id]").filter({ hasText: name });
  await expect(reloaded).toBeVisible();
  // The block and the listing are metadata: the bytes must still be there.
  expect(sha256(await downloaded(page, () => reloaded.getByRole("link").click()))).toBe(sha256(kept));
});
