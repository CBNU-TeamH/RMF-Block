import { randomUUID } from "node:crypto";

import { expect, test, type Users } from "../fixtures";
import { block, createDocument, firstBlockId, insertAt, openDocument } from "../helpers";
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

async function join(visitor: Visitor) {
  const response = await visitor.context.request.post("/api/workspace/join", {
    data: { nickname: visitor.name, password: accessPassword, force: true },
  });
  expect(response.ok(), await response.text()).toBe(true);
}

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

  const secret = process.env.E2E_HOST_SECRET;
  if (!secret) throw new Error("Run lifecycle specs with `pnpm e2e:isolated --lifecycle`.");
  await page.goto("/join");
  // Browser-side navigation keeps the credential out of Playwright step titles.
  await page.evaluate((credential) => {
    window.location.assign(`/api/auth/host?secret=${encodeURIComponent(credential)}`);
  }, secret);
  await expect(page.getByRole("heading", { name: "워크스페이스 열기" })).toBeVisible();

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

test("when the app cannot register with Yorkie it refuses to start and prints why (FR-010-06)", async () => {
  test.setTimeout(120_000);
  // A one-off app container, not the running one: it has the wrong Yorkie admin password and no
  // published port, so it cannot disturb the stack. A password Yorkie rejects fails at once; an
  // unreachable Yorkie does not (the call has no timeout), which is why this is not "stop Yorkie".
  const { ok, output } = await composeOutcome("run", "--rm", "-T", "--no-deps", "-e", "YORKIE_ADMIN_PASSWORD=not-the-admin-password", "app");
  expect(ok, "the app should have exited with a failure").toBe(false);
  expect(output).toContain("Could not register the Yorkie auth webhook");
  expect(output).toContain("Refusing to start");
  // The reason names what failed, not only that something did.
  expect(output).toMatch(/\(401\)|failed/);
});
