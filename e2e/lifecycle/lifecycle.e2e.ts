import { randomUUID } from "node:crypto";

import type { APIRequestContext, Page } from "@playwright/test";

import { expect, test, type Users } from "../fixtures";
import { block, createDocument, fileRow, firstBlockId, insertAt, openDocument, sendChatFile } from "../helpers";
import { appLog, appReady, compose, composeOutcome } from "../stack";

/**
 * UC-010 and the server-lifecycle requirements, on a stack nobody has set up (`pnpm e2e:isolated
 * --lifecycle`). The tests run in order and share that one stack: opening the workspace comes first,
 * each later test starts from what the one before left. Traces are off: the host secret is in the
 * bootstrap URL and the role cookie.
 */
test.describe.configure({ mode: "serial" });
test.use({ trace: "off" });

const workspace = `e2e lifecycle ${Date.now()}`;
const accessPassword = `e2e-${randomUUID()}`;
const text = `survives ${Date.now()}`;
let documentId = "";
let blockId = "";

type Visitor = Awaited<ReturnType<Users["visitor"]>>;

const joinNamed = (request: APIRequestContext, nickname: string) =>
  request.post("/api/workspace/join", { data: { nickname, password: accessPassword, force: true } });

async function join(visitor: Visitor) {
  const response = await joinNamed(visitor.context.request, visitor.name);
  expect(response.ok(), await response.text()).toBe(true);
}

/** Signs `page` in as the host on a workspace nobody has set up — `bootstrapHost` waits for a sidebar
 *  that does not exist yet. Browser-side navigation keeps the credential out of Playwright step titles. */
async function bootstrapUnopened(page: Page) {
  const secret = process.env.E2E_HOST_SECRET;
  if (!secret) throw new Error("Run lifecycle specs with `pnpm e2e:isolated --lifecycle`.");
  await page.goto("/join");
  await page.evaluate((credential) => {
    window.location.assign(`/api/auth/host?secret=${encodeURIComponent(credential)}`);
  }, secret);
  await expect(page.getByRole("heading", { name: "워크스페이스 열기" })).toBeVisible();
}

test("before setup a too-short password and a password change are refused, and the workspace stays closed (FR-010-02, FR-011-04)", async ({ page, users }) => {
  await bootstrapUnopened(page);

  const short = await page.request.post("/api/workspace", { data: { name: workspace, password: "abc" } });
  expect(short.status(), await short.text()).toBe(400);
  expect(await short.json()).toEqual({ error: "비밀번호는 4자 이상이어야 합니다." });
  const shortChange = await page.request.patch("/api/workspace/password", { data: { password: "abc" } });
  expect(shortChange.status()).toBe(400);
  // A password change must not stand in for the setup screen: there is no workspace to change yet.
  const early = await page.request.patch("/api/workspace/password", { data: { password: accessPassword } });
  expect(early.status()).toBe(409);
  expect(await early.json()).toEqual({ error: "워크스페이스가 아직 열리지 않았습니다." });

  // None of it opened the workspace: the setup screen is still there, and guests are still turned away.
  await page.reload();
  await expect(page.getByRole("heading", { name: "워크스페이스 열기" })).toBeVisible();
  const guest = await users.visitor(0);
  const refused = await guest.context.request.post("/api/workspace/join", {
    data: { nickname: guest.name, password: accessPassword },
  });
  expect(refused.status()).toBe(503);
});

test("an unopened workspace turns guests away, and the host's setup opens it (FR-010-01~04)", async ({ page, users }) => {
  // FR-010-03: the host's screen is the startup banner — the join address, and that setup is unfinished.
  const banner = await appLog();
  expect(banner).toContain("host user의 workspace setting이 완료되지 않았습니다.");
  expect(banner).toMatch(/Guest: http:\/\/127\.0\.0\.1:3000/);

  const early = await users.visitor(0);
  const refused = await early.context.request.post("/api/workspace/join", {
    data: { nickname: early.name, password: accessPassword },
  });
  expect(refused.status()).toBe(503);

  await bootstrapUnopened(page);

  // FR-010-01/02: the setup screen takes a name and a password.
  await page.getByLabel("워크스페이스 이름").fill(workspace);
  await page.getByLabel("접속 비밀번호").fill(accessPassword);
  await page.getByRole("button", { name: "워크스페이스 열기" }).click();
  await expect(page.getByRole("complementary").getByRole("textbox", { name: "문서 제목 검색" })).toBeVisible();

  // FR-010-04: joinable now, with the password just set and no other.
  const wrong = await early.context.request.post("/api/workspace/join", {
    data: { nickname: early.name, password: `${accessPassword}-wrong` },
  });
  expect(wrong.status()).toBe(401);
  await join(early);

  documentId = await createDocument(page, `e2e lifecycle doc ${Date.now()}`);
  await openDocument(page, documentId);
  blockId = await firstBlockId(page);
  await insertAt(page, blockId, 0, text);
  // Seen by a second client: Yorkie has the edit, not just this page.
  const reader = await users.visitor(1);
  await join(reader);
  await openDocument(reader.page, documentId);
  await expect(block(reader.page, blockId)).toHaveValue(text);
});

test("a restart keeps the workspace, its password and its documents, and ends every session (FR-010-05, NFR-REL-002)", async ({ users }) => {
  test.setTimeout(150_000);
  const before = await users.visitor(2);
  await join(before);
  expect((await before.context.request.get("/api/documents")).status()).toBe(200);

  await compose("restart", "app");
  await appReady();

  // Sessions live in memory: the restart is the revoke path (`AGENTS.md` §1).
  expect((await before.context.request.get("/api/documents")).status()).toBe(401);

  // The workspace did not need setting up again: the saved password admits, the document is there.
  const after = await users.visitor(3);
  await join(after);
  const { documents } = (await (await after.context.request.get("/api/documents")).json()) as { documents: Array<{ id: string }> };
  expect(documents.map((document) => document.id)).toContain(documentId);
  await openDocument(after.page, documentId);
  await expect(block(after.page, blockId)).toHaveValue(text);

  const banner = await appLog();
  expect(banner).toContain(`Workspace "${workspace}" — saved settings in .data/workspace.json`);
});

test("after the app and Yorkie are killed, the last persisted document comes back (NFR-SAF-003)", async ({ users }) => {
  test.setTimeout(240_000);
  const writer = await users.visitor(4);
  await join(writer);
  await openDocument(writer.page, documentId);
  const kept = ` and ${Date.now()}`;
  await insertAt(writer.page, blockId, text.length, kept);
  // Persisted means another client reads it from Yorkie, whose changes MongoDB holds.
  const reader = await users.visitor(5);
  await join(reader);
  await openDocument(reader.page, documentId);
  await expect(block(reader.page, blockId)).toHaveValue(`${text}${kept}`);

  // SIGKILL, not stop: the processes get no chance to flush anything. MongoDB stays up.
  await compose("kill", "app", "yorkie");
  await compose("up", "-d", "--wait", "--wait-timeout", "180");
  await appReady();

  const back = await users.visitor(6);
  await join(back);
  await openDocument(back.page, documentId);
  await expect(block(back.page, blockId)).toHaveValue(`${text}${kept}`);
});

/**
 * STC-050-007: with Yorkie not answering, the file manager cannot read which files the documents hold.
 * It still lists the chat's files, says why the rest are missing, and offers a retry that works once
 * Yorkie is back. Paused, not stopped: a request to it hangs until the app's own limit, as on a stalled LAN.
 */
test("with Yorkie unreachable the file manager keeps the chat files, says why, and recovers on retry (FR-050-02)", async ({ users }) => {
  test.setTimeout(150_000);
  const visitor = await users.visitor(7);
  await join(visitor);
  const name = `e2e-lifecycle-${Date.now()}.bin`;
  await sendChatFile(visitor.context.request, { name, mimeType: "application/octet-stream", buffer: Buffer.from("chat file") });
  const notice = visitor.page.getByRole("status").filter({ hasText: "문서에 들어 있는 파일을 불러오지 못해 채팅 파일만 보입니다." });

  await compose("pause", "yorkie");
  try {
    // The listing waits out the app's limit on Yorkie (10 s) before the tabs appear.
    const row = await fileRow(visitor.page, "기타", name);
    await expect(notice).toBeVisible();
    await expect(row).toHaveCount(1);
  } finally {
    await compose("unpause", "yorkie");
  }

  await notice.getByRole("button", { name: "다시 시도" }).click();
  await expect(notice).toHaveCount(0, { timeout: 30_000 });
  await expect(visitor.page.getByRole("row").filter({ hasText: name })).toHaveCount(1);
});

test("when the app cannot register with Yorkie it refuses to start and prints why (FR-010-06)", async () => {
  test.setTimeout(120_000);
  // A one-off app container, not the running one: it has the wrong Yorkie admin password and no
  // published port, so it cannot disturb the stack. A password Yorkie rejects fails at once; an
  // unanswered Yorkie takes the request limit and the retries (minutes), which is why this is not "pause Yorkie".
  const { ok, output } = await composeOutcome("run", "--rm", "-T", "--no-deps", "-e", "YORKIE_ADMIN_PASSWORD=not-the-admin-password", "app");
  expect(ok, "the app should have exited with a failure").toBe(false);
  expect(output).toContain("Could not register the Yorkie auth webhook");
  expect(output).toContain("Refusing to start");
  // The reason names what failed, not only that something did.
  expect(output).toMatch(/\(401\)|failed/);
});

/**
 * NFR-SEC-002: 64 members and no more. The cap counts members the workspace has stored, not the ones
 * online, so filling it leaves the stack closed to every new nickname for good. That is why these
 * run last, on the stack this spec file owns.
 */
test("a full workspace turns a new nickname away and still admits a member who is already in (NFR-SEC-002)", async ({ request }) => {
  test.setTimeout(150_000);
  const names = Array.from({ length: 70 }, (_, index) => `e2e-cap-${index}`);

  // The earlier tests stored some members: exactly the rest of the 64 get in, and the next does not.
  const stored = Number(await compose("exec", "-T", "app", "node", "-p", "require('./.data/members.json').length"));
  let admitted = 0;
  while (admitted < names.length && (await joinNamed(request, names[admitted]!)).ok()) admitted += 1;
  expect(admitted).toBe(64 - stored);

  // Full is not locked: a nickname the workspace already knows gets back in, and a stranger does not.
  expect((await joinNamed(request, names[0]!)).status()).toBe(200);
  expect((await joinNamed(request, "e2e-cap-stranger")).ok()).toBe(false);
});

// #273: these two answered 500 in the container, because the route's `instanceof` checks never matched
// the errors the shared registry throws.
test("a full workspace says so: 503 and the cap in the message (NFR-SEC-002)", async ({ request }) => {
  const refused = await joinNamed(request, "e2e-cap-stranger");
  expect(refused.status()).toBe(503);
  expect(await refused.json()).toEqual({ error: "이 워크스페이스는 64명까지만 참여할 수 있습니다." });
});

test("a blank or over-long nickname is a 400 with the reason (FR-020-02)", async ({ request }) => {
  for (const nickname of ["", "x".repeat(21)]) {
    const refused = await joinNamed(request, nickname);
    expect(refused.status(), JSON.stringify(nickname)).toBe(400);
    expect(await refused.json()).toHaveProperty("error");
  }
});
