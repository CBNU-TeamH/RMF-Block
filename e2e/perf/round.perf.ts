import { execFileSync } from "node:child_process";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium, type Browser, type Page } from "@playwright/test";

import { expect, test } from "../fixtures";
import { block, blockValues, createDocument, firstBlock, insertAt, online, openChat, openDocument, sendChat } from "../helpers";
import { YORKIE_SERVICE, networkProbe } from "../network";
import { traceMemory } from "./memory";
import { installProbe, marker, type PerfWindow } from "./probe";
import { APP_IMAGE, sampleDockerStats, stackDown, stackUp } from "./stack";

const env = process.env;
const RUN_ID = env.PERF_RUN_ID!;
const RUN_DIR = path.resolve("perf-results", RUN_ID);
const ROUNDS = Number(env.PERF_ROUNDS ?? 1);
const USERS = Number(env.PERF_USERS ?? 8);
const MINUTES = Number(env.PERF_MINUTES ?? 10);
const OUTAGE = Number(env.PERF_OUTAGE ?? 0);
const HOST = env.HOST_LAN_IP ?? "127.0.0.1";
const APP_PORT = Number(env.PERF_APP_PORT ?? 3000);
const YORKIE_PORT = Number(env.PERF_YORKIE_PORT ?? 8080);
const CHANNEL = env.PERF_CHANNEL ?? "chrome";
const PASSWORD = env.E2E_WORKSPACE_PASSWORD!;
const BASE_URL = `http://${HOST}:${APP_PORT}`;
const VIEWPORT = { width: 1280, height: 720 };
const SEED = "perf seed";
const BLOCKS = 60;
/** Presenter targets: blocks 10–29, with enough below each for it to reach the top. */
const TARGETS = Array.from({ length: 20 }, (_, i) => 10 + i);
const ACTIONS = 30; // 20 edits + 10 chats per user (NFR-PER-001's workload)

const now = () => performance.timeOrigin + performance.now();

type Actor = { client: string; page: Page; block: string };
type Note = Record<string, unknown>;

/** H's and G's measuring Chrome. G is a browser server on the guest device (`perf:browser`);
 *  without `PERF_G_WS` it is launched here, for a single-machine run. */
function measuringBrowser(ws?: string): Promise<Browser> {
  if (ws) return chromium.connect(ws);
  return chromium.launch({ channel: CHANNEL === "bundled" ? undefined : CHANNEL, headless: env.PERF_HEADED === "0" });
}

async function measuringPage(browser: Browser, client: string): Promise<Page> {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: VIEWPORT });
  await context.addInitScript(installProbe, client);
  return context.newPage();
}

/** Clock samples against ours (`stats.offsetFrom` picks the shortest round trip). */
async function readClock(page: Page) {
  const samples = [];
  for (let i = 0; i < 15; i++) {
    const sent = now();
    const read = await page.evaluate(() => performance.timeOrigin + performance.now());
    samples.push({ sent, page: read, received: now() });
  }
  return samples;
}

/** NFR-PER-001's failure signals for one page: error responses, closed sockets, ended Watch
 *  streams (as `e2e/network.ts` observes them) and page errors. */
async function watch(page: Page, who: string, notes: Array<Note>) {
  const push = (note: Note) => notes.push({ at: now(), who, ...note });
  page.on("response", (response) => {
    if (response.status() >= 400) push({ kind: "http", status: response.status(), url: response.url() });
  });
  page.on("websocket", (socket) => socket.on("close", () => push({ kind: "ws-close", url: socket.url() })));
  page.on("pageerror", (error) => push({ kind: "page-error", message: error.message }));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  const watches = new Set<string>();
  cdp.on("Network.responseReceived", (event) => {
    if (event.response.url.includes(`${YORKIE_SERVICE}Watch`)) watches.add(event.requestId);
  });
  const ended = (event: { requestId: string }) => {
    if (watches.delete(event.requestId)) push({ kind: "watch-end" });
  };
  cdp.on("Network.loadingFailed", ended);
  cdp.on("Network.loadingFinished", ended);
}

/** Each user's 20 edits and 10 chats, evenly spaced and staggered, in a fixed order. */
async function work(round: number, actors: Array<Actor>, minutes: number, seq: number, plan: Array<Note>, notes: Array<Note>) {
  const every = (minutes * 60_000) / ACTIONS;
  const start = Date.now();
  await Promise.all(actors.map(async (actor, index) => {
    for (let k = 0; k < ACTIONS; k++) {
      await delay(Math.max(0, start + k * every + (index * every) / actors.length - Date.now()));
      const chat = k % 3 === 2;
      const text = marker(round, actor.client, chat ? "c" : "e", seq + k);
      plan.push({ item: chat ? "004" : "002", marker: text, from: actor.client });
      try {
        if (chat) await sendChat(actor.page, text);
        else await insertAt(actor.page, actor.block, (await block(actor.page, actor.block).inputValue()).length, ` ${text}`);
      } catch (error) {
        notes.push({ at: now(), who: actor.client, kind: "action-error", message: String(error) });
      }
    }
  }));
}

/** NFR-PER-005: the lead shares, the other follows, and the lead scrolls 20 blocks to the top. */
async function present(round: number, lead: Actor, follow: Actor, blocks: Array<string>, plan: Array<Note>) {
  await lead.page.getByRole("button", { name: "공유하기", exact: true }).click();
  await follow.page.getByRole("button", { name: /공유 중 · 참여하기/ }).click();
  await expect(follow.page.getByRole("button", { name: /따라가는 중/ })).toBeVisible();
  for (const [i, index] of TARGETS.entries()) {
    const target = { marker: marker(round, lead.client, "p", i), block: blocks[index] };
    plan.push({ item: "005", marker: target.marker, from: lead.client });
    await follow.page.evaluate((t) => {
      (window as PerfWindow).__perfFollow = t;
    }, target);
    await lead.page.evaluate((t) => {
      const box = document.querySelector<HTMLElement>("[data-focus-scroll]")!;
      const row = box.querySelector(`[data-block-id="${t.block}"]`)!;
      (window as PerfWindow).__perfLead = t;
      box.scrollTop += row.getBoundingClientRect().top - box.getBoundingClientRect().top;
    }, target);
    await delay(3000);
  }
  await lead.page.getByRole("button", { name: "공유 종료", exact: true }).click();
  const following = follow.page.getByRole("button", { name: /따라가는 중/ });
  if (await following.isVisible()) await following.click();
}

/** #193's outage protocol on G: cut, keep working on both sides, restore, resend. */
async function outage(round: number, h: Actor, g: Actor, probe: Awaited<ReturnType<typeof networkProbe>>, plan: Array<Note>, meta: Note) {
  await probe.disconnect(true);
  await g.page.evaluate(() => {
    for (const socket of (window as Window & { e2eSockets?: Array<WebSocket> }).e2eSockets ?? []) {
      if (socket.url.endsWith("/api/workspace/ws")) socket.close(4000, "perf outage");
    }
  });
  meta.cutAt = now();
  for (const [actor, kind] of [[h, "o"], [g, "o"], [h, "c"]] as const) {
    for (const k of [0, 1]) {
      const text = marker(round, actor.client, kind, 200 + k);
      plan.push({ item: kind === "c" ? "004" : "002", marker: text, from: actor.client, outage: true });
      if (kind === "c") await sendChat(actor.page, text);
      else await insertAt(actor.page, actor.block, (await block(actor.page, actor.block).inputValue()).length, ` ${text}`);
    }
  }
  const offline = marker(round, g.client, "c", 300);
  plan.push({ item: "004", marker: offline, from: g.client, outage: true, resend: true });
  await sendChat(g.page, offline);
  const resend = g.page.getByRole("button", { name: "전송 실패 · 다시 보내기" });
  meta.failedShown = await resend.waitFor({ timeout: OUTAGE * 1000 }).then(() => true, () => false);
  await delay(Math.max(0, (meta.cutAt as number) + OUTAGE * 1000 - now()));
  const opensBefore = await g.page.evaluate(() =>
    ((window as Window & { e2eSocketEvents?: Array<{ url: string; type: string }> }).e2eSocketEvents ?? []).filter((e) => e.type === "open").map((e) => e.url));
  await probe.restore();
  meta.restoreAt = now();
  const reopened = async (pathname: string) => {
    const deadline = now() + 30_000;
    while (now() < deadline) {
      const opens = await g.page.evaluate(() =>
        ((window as Window & { e2eSocketEvents?: Array<{ url: string; type: string }> }).e2eSocketEvents ?? []).filter((e) => e.type === "open").map((e) => e.url));
      if (opens.filter((url) => url.endsWith(pathname)).length > opensBefore.filter((url) => url.endsWith(pathname)).length) return now();
      await delay(100);
    }
    return null;
  };
  [meta.chatReopenAt, meta.sessionReopenAt] = await Promise.all([reopened("/api/chat/ws"), reopened("/api/workspace/ws")]);
  if (meta.failedShown) {
    meta.resendAt = now();
    await resend.click();
  }
}

/** Convergence and exactly-once delivery across every client, plus the disconnect badge. */
async function verify(actors: Array<Actor>, plan: Array<Note>, notes: Array<Note>) {
  const values = () => Promise.all(actors.map((actor) => blockValues(actor.page)));
  const converged = await expect.poll(async () => {
    const all = (await values()).map((v) => JSON.stringify(v));
    return all.every((v) => v === all[0]);
  }, { timeout: 30_000 }).toBe(true).then(() => true, () => false);
  if (!converged) notes.push({ at: now(), who: "all", kind: "no-convergence" });
  const text = (await values())[0].map((row) => row.text).join("\n");
  for (const { marker: m } of plan.filter((p) => p.item === "002")) {
    const count = text.split(m as string).length - 1;
    if (count !== 1) notes.push({ at: now(), who: "all", kind: "edit-count", marker: m, count });
  }
  for (const viewer of actors.filter((a) => a.client === "H" || a.client === "G")) {
    const chat = await viewer.page.getByRole("region", { name: "채팅" }).innerText();
    for (const { marker: m } of plan.filter((p) => p.item === "004")) {
      const count = chat.split(m as string).length - 1;
      if (count !== 1) notes.push({ at: now(), who: viewer.client, kind: "chat-count", marker: m, count });
    }
  }
  for (const actor of actors) {
    if (await actor.page.getByText("연결 끊김").count()) notes.push({ at: now(), who: actor.client, kind: "badge" });
  }
}

const jsonl = (rows: Array<object>) => rows.map((row) => JSON.stringify(row)).join("\n") + "\n";

for (let round = 1; round <= ROUNDS; round++) {
  test(`round ${round}`, async ({ users }) => {
    const dir = path.join(RUN_DIR, `round-${String(round).padStart(2, "0")}`);
    await mkdir(dir, { recursive: true });
    const stack = await stackUp({
      project: `rmf-perf-${RUN_ID}-${round}`,
      dir,
      bind: env.PERF_BIND ?? "0.0.0.0",
      host: HOST,
      appPort: APP_PORT,
      yorkiePort: YORKIE_PORT,
      password: PASSWORD,
    });
    const stats = sampleDockerStats(stack);
    const browsers: Array<Browser> = [];
    const plan: Array<Note> = [];
    const notes: Array<Note> = [];
    const meta: Note = { round };
    try {
      const hBrowser = await measuringBrowser();
      browsers.push(hBrowser);
      const hPage = await measuringPage(hBrowser, "H");
      await watch(hPage, "H", notes);
      const joined = await hPage.request.post("/api/workspace/join", { data: { nickname: "perf-H", password: PASSWORD, force: true } });
      expect(joined.ok(), await joined.text()).toBe(true);
      const doc = await createDocument(hPage, SEED);
      await openDocument(hPage, doc);
      await firstBlock(hPage).focus();
      for (let i = 0; i < BLOCKS; i++) {
        await hPage.keyboard.insertText(`b${i}`);
        if (i < BLOCKS - 1) await hPage.keyboard.press("Enter");
      }
      await expect(hPage.locator("[data-block-id] textarea")).toHaveCount(BLOCKS + 1); // a new document ends in an empty block
      const seeds = await blockValues(hPage);
      const blocks = seeds.map((row) => row.id);

      const background: Array<Actor> = [];
      for (let slot = 0; slot < USERS - 2; slot++) {
        const page = (await users.join(slot)).page;
        await watch(page, `b${slot}`, notes);
        await openDocument(page, doc);
        background.push({ client: `b${slot}`, page, block: blocks[2 + slot] });
      }

      const gBrowser = await measuringBrowser(env.PERF_G_WS || undefined);
      browsers.push(gBrowser);
      const gPage = await measuringPage(gBrowser, "G");
      await watch(gPage, "G", notes);
      const probe = OUTAGE ? await networkProbe(gPage, "chat") : null;
      const memory = { H: await traceMemory(hBrowser), G: await traceMemory(gBrowser) };
      await gPage.goto("/join");
      await gPage.evaluate((expected) => sessionStorage.setItem("perf-join", JSON.stringify(expected)), { doc: SEED, count: USERS });
      await gPage.getByLabel("닉네임").fill("perf-G");
      await gPage.getByLabel("워크스페이스 비밀번호").fill(PASSWORD);
      await gPage.getByRole("button", { name: "입장", exact: true }).click();
      await expect.poll(() => gPage.evaluate(() => (window as PerfWindow).__perf?.some((e) => e.item === "003" && e.kind === "recv")), { timeout: 30_000 })
        .toBe(true).catch(() => notes.push({ at: now(), who: "G", kind: "join-timeout" }));
      if (!gPage.url().endsWith(`/documents/${doc}`)) await openDocument(gPage, doc);

      const h = { client: "H", page: hPage, block: blocks[0] };
      const g = { client: "G", page: gPage, block: blocks[1] };
      const actors = [h, g, ...background];
      await Promise.all(actors.map((actor) => online(actor.page, USERS)));
      await Promise.all(actors.map((actor) => expect.poll(() => blockValues(actor.page)).toEqual(seeds)));
      await Promise.all(actors.map((actor) => openChat(actor.page)));
      if (probe) await probe.ready();

      const clock: Note = { start: { H: await readClock(hPage), G: await readClock(gPage) } };
      meta.windowStart = now();
      if (OUTAGE) {
        await work(round, actors, MINUTES, 0, plan, notes);
        await outage(round, h, g, probe!, plan, meta);
        await work(round, actors, MINUTES, 100, plan, notes);
      } else {
        await work(round, actors, MINUTES, 0, plan, notes);
        await present(round, h, g, blocks, plan);
        await present(round, g, h, blocks, plan);
      }
      await verify(actors, plan, notes);
      meta.windowEnd = now();
      clock.end = { H: await readClock(hPage), G: await readClock(gPage) };

      const rtt = await gPage.evaluate(async (url) => {
        const out = [];
        for (let i = 0; i < 20; i++) {
          const t = performance.now();
          await fetch(url, { mode: "no-cors", cache: "no-store" });
          out.push(performance.now() - t);
        }
        return out;
      }, `http://${HOST}:${YORKIE_PORT}${YORKIE_SERVICE}health`);
      const events = [
        ...(await hPage.evaluate(() => (window as PerfWindow).__perf ?? [])).map((e) => ({ device: "H", ...e })),
        ...(await gPage.evaluate(() => (window as PerfWindow).__perf ?? [])).map((e) => ({ device: "G", ...e })),
      ];
      const samples = [
        ...(await memory.H.stop()).map((s) => ({ device: "H", ...s })),
        ...(await memory.G.stop()).map((s) => ({ device: "G", ...s })),
      ];
      const conditions = {
        runId: RUN_ID,
        round,
        revision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        image: APP_IMAGE,
        users: USERS,
        minutes: MINUTES,
        outage: OUTAGE,
        preset: env.PERF_PRESET ?? "baseline",
        host: HOST,
        ports: { app: APP_PORT, yorkie: YORKIE_PORT },
        viewport: VIEWPORT,
        browsers: { H: hBrowser.version(), G: gBrowser.version() },
        userAgents: { H: await hPage.evaluate(() => navigator.userAgent), G: await gPage.evaluate(() => navigator.userAgent) },
        hostPlatform: `${os.platform()} ${os.release()} · ${os.cpus().length} CPU · ${Math.round(os.totalmem() / 2 ** 30)} GB`,
        gRemote: Boolean(env.PERF_G_WS),
        node: process.version,
        blocks: BLOCKS,
        targets: TARGETS.length,
      };
      await writeFile(path.join(dir, "conditions.json"), JSON.stringify(conditions, null, 2));
      await writeFile(path.join(dir, "clock.json"), JSON.stringify(clock));
      await writeFile(path.join(dir, "meta.json"), JSON.stringify(meta));
      await writeFile(path.join(dir, "rtt.json"), JSON.stringify(rtt));
      await writeFile(path.join(dir, "plan.jsonl"), jsonl(plan));
      await writeFile(path.join(dir, "events.jsonl"), jsonl(events));
      await writeFile(path.join(dir, "memory.jsonl"), jsonl(samples));
    } finally {
      await appendFile(path.join(dir, "signals.jsonl"), notes.length ? jsonl(notes) : "");
      await stats.stop();
      for (const browser of browsers) await browser.close().catch(() => {});
      await stackDown(stack);
    }
  });
}
