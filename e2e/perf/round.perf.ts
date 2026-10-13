import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium, type Browser, type Page } from "@playwright/test";

import { expect, test } from "../fixtures";
import { block, blockValues, createDocument, firstBlock, insertAt, joinForm, online, openChat, openDocument, sendChat } from "../helpers";
import { YORKIE_SERVICE, networkProbe } from "../network";
import { traceMemory } from "./memory";
import { attach, detach, type Attached, type Mark } from "./observe";
import { installProbe, marker, measuringLaunch, type PerfWindow } from "./probe";
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
const G_WS = env.PERF_G_WS || undefined;
const OBSERVE = env.PERF_OBSERVE === "1";
const PASSWORD = env.E2E_WORKSPACE_PASSWORD!;
const BASE_URL = `http://${HOST}:${APP_PORT}`;
const VIEWPORT = { width: 1280, height: 720 };
const SEED = "perf seed";
const BLOCKS = 60;
/** Presenter targets: blocks 10–29, with enough below each for it to reach the top. */
const TARGETS = Array.from({ length: 20 }, (_, i) => 10 + i);
const ACTIONS = 30; // 20 edits + 10 chats per user (NFR-PER-001's workload)

// A campaign that forgot PERF_G_WS would quietly measure one machine against itself.
if (!G_WS && env.PERF_SINGLE_MACHINE !== "1") {
  throw new Error("Set PERF_G_WS to G's browser server (runbook §7), or PERF_SINGLE_MACHINE=1 for a one-machine check.");
}

const now = () => performance.timeOrigin + performance.now();

type Actor = { client: string; page: Page; block: string };
type Note = Record<string, unknown>;
/** Where a round is: passive signals count as failures only in `window` (`report.mts`). */
type Phase = "setup" | "window" | "outage" | "teardown";
type Round = { round: number; phase: Phase; plan: Array<Note>; notes: Array<Note> };

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

/** NFR-PER-001's passive signals for one page: error responses, closed sockets, ended Watch
 *  streams and page errors, each tagged with the round's phase. */
function watch(page: Page, who: string, r: Round) {
  const push = (note: Note) => r.notes.push({ at: now(), who, phase: r.phase, ...note });
  const watchEnded = (request: { url: () => string }) => {
    if (request.url().includes(`${YORKIE_SERVICE}Watch`)) push({ kind: "watch-end" });
  };
  page.on("response", (response) => {
    if (response.status() >= 400) push({ kind: "http", status: response.status(), url: response.url() });
  });
  page.on("requestfinished", watchEnded);
  page.on("requestfailed", watchEnded);
  page.on("websocket", (socket) => socket.on("close", () => push({ kind: "ws-close", url: socket.url() })));
  page.on("pageerror", (error) => push({ kind: "page-error", message: error.message }));
}

/** One user action: a chat message, or a marker appended to the user's own block. */
async function act(r: Round, actor: Actor, kind: "e" | "c", seq: number, phase?: "outage" | "resend") {
  const text = marker(r.round, actor.client, kind, seq);
  r.plan.push({ item: kind === "c" ? "004" : "002", marker: text, from: actor.client, ...(phase && { phase }) });
  if (kind === "c") await sendChat(actor.page, text);
  else await insertAt(actor.page, actor.block, (await block(actor.page, actor.block).inputValue()).length, ` ${text}`);
}

/** Each user's 20 edits and 10 chats, evenly spaced and staggered, in a fixed order. */
async function work(r: Round, actors: Array<Actor>, minutes: number, seq: number) {
  const every = (minutes * 60_000) / ACTIONS;
  const start = Date.now();
  await Promise.all(actors.map(async (actor, index) => {
    for (let k = 0; k < ACTIONS; k++) {
      await delay(Math.max(0, start + k * every + (index * every) / actors.length - Date.now()));
      await act(r, actor, k % 3 === 2 ? "c" : "e", seq + k)
        .catch((error) => r.notes.push({ at: now(), who: actor.client, phase: r.phase, kind: "action-error", message: String(error) }));
    }
  }));
}

/** NFR-PER-005: the lead shares, the other follows, and the lead scrolls 20 blocks to the top. */
async function present(r: Round, lead: Actor, follow: Actor, blocks: Array<string>) {
  await lead.page.getByRole("button", { name: "공유하기", exact: true }).click();
  await follow.page.getByRole("button", { name: /공유 중 · 참여하기/ }).click();
  await expect(follow.page.getByRole("button", { name: /따라가는 중/ })).toBeVisible();
  for (const [i, index] of TARGETS.entries()) {
    const target = { marker: marker(r.round, lead.client, "p", i), block: blocks[index] };
    r.plan.push({ item: "005", marker: target.marker, from: lead.client });
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
async function outage(r: Round, h: Actor, g: Actor, probe: Awaited<ReturnType<typeof networkProbe>>, meta: Note) {
  r.phase = "outage";
  await probe.disconnect(true);
  meta.cutAt = now();
  for (const k of [0, 1]) {
    await act(r, h, "e", 200 + k, "outage");
    await act(r, g, "e", 200 + k, "outage");
    await act(r, h, "c", 200 + k, "outage");
  }
  await act(r, g, "c", 300, "resend");
  const resend = g.page.getByRole("button", { name: "전송 실패 · 다시 보내기" });
  meta.failedShown = await resend.waitFor({ timeout: OUTAGE * 1000 }).then(() => true, () => false);
  await delay(Math.max(0, (meta.cutAt as number) + OUTAGE * 1000 - now()));
  const before = { chat: await probe.opens("chat"), session: await probe.opens("workspace") };
  await probe.restore();
  meta.restoreAt = now();
  const deadline = now() + 30_000;
  while (now() < deadline && (meta.chatReopenAt === undefined || meta.sessionReopenAt === undefined)) {
    if (meta.chatReopenAt === undefined && (await probe.opens("chat")) > before.chat) meta.chatReopenAt = now();
    if (meta.sessionReopenAt === undefined && (await probe.opens("workspace")) > before.session) meta.sessionReopenAt = now();
    await delay(100);
  }
  meta.chatReopenAt ??= null;
  meta.sessionReopenAt ??= null;
  r.phase = "window";
  if (meta.failedShown) {
    meta.resendAt = now();
    await resend.click();
  }
}

/** Convergence and exactly-once delivery across every client, plus the disconnect badge. */
async function verify(r: Round, actors: Array<Actor>) {
  const failed = (note: Note) => r.notes.push({ at: now(), phase: r.phase, ...note });
  const values = () => Promise.all(actors.map((actor) => blockValues(actor.page)));
  const converged = await expect.poll(async () => {
    const all = (await values()).map((v) => JSON.stringify(v));
    return all.every((v) => v === all[0]);
  }, { timeout: 30_000 }).toBe(true).then(() => true, () => false);
  if (!converged) failed({ who: "all", kind: "no-convergence" });
  const text = (await values())[0].map((row) => row.text).join("\n");
  for (const { marker: m } of r.plan.filter((p) => p.item === "002")) {
    const count = text.split(m as string).length - 1;
    if (count !== 1) failed({ who: "all", kind: "edit-count", marker: m, count });
  }
  for (const viewer of actors.filter((a) => a.client === "H" || a.client === "G")) {
    const chat = await viewer.page.getByRole("region", { name: "채팅" }).innerText();
    for (const { marker: m } of r.plan.filter((p) => p.item === "004")) {
      const count = chat.split(m as string).length - 1;
      if (count !== 1) failed({ who: viewer.client, kind: "chat-count", marker: m, count });
    }
  }
  for (const actor of actors) {
    if (await actor.page.getByText("연결 끊김").count()) failed({ who: actor.client, kind: "badge" });
  }
}

const jsonl = (rows: Array<object>) => rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : "");

for (let round = 1; round <= ROUNDS; round++) {
  test(`round ${round}`, async ({ users }) => {
    const dir = path.join(RUN_DIR, `round-${String(round).padStart(2, "0")}`);
    await mkdir(dir, { recursive: true });
    const write = (name: string, data: string) => writeFile(path.join(dir, name), data);
    // Written first, so a round that aborts is still counted (`report.mts`).
    const conditions: Note = {
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
      hostPlatform: `${os.platform()} ${os.release()} · ${os.cpus().length} CPU · ${Math.round(os.totalmem() / 2 ** 30)} GB`,
      gRemote: Boolean(G_WS),
      observe: OBSERVE,
      node: process.version,
      blocks: BLOCKS,
      targets: TARGETS.length,
    };
    await write("conditions.json", JSON.stringify(conditions, null, 2));
    const r: Round = { round, phase: "setup", plan: [], notes: [] };
    const meta: Note = { round };
    const browsers: Array<Browser> = [];
    // Stopped on every path: a trace left running on G's browser refuses the next round's.
    let memory: Record<"H" | "G", Awaited<ReturnType<typeof traceMemory>>> | null = null;
    const stack = await stackUp({
      project: `rmf-perf-${RUN_ID}-${round}`,
      dir,
      bind: env.PERF_BIND ?? "0.0.0.0",
      host: HOST,
      appPort: APP_PORT,
      yorkiePort: YORKIE_PORT,
      password: PASSWORD,
    }).catch(async (error) => {
      r.notes.push({ at: now(), who: "harness", phase: r.phase, kind: "aborted", message: String(error) });
      await write("signals.jsonl", jsonl(r.notes));
      throw error;
    });
    const stats = sampleDockerStats(stack);
    // Diagnostics (#192): a failure here is noted in meta, never a signal that fails 001.
    const marks: Array<Mark> = [];
    const observed: Attached | null = OBSERVE
      ? await attach(stack, RUN_ID, round).catch((error) => {
          meta.observe = String(error);
          console.warn(`Round ${round} is not observed: ${error}`);
          return null;
        })
      : null;
    try {
      const hBrowser = await chromium.launch(measuringLaunch());
      browsers.push(hBrowser);
      const hPage = await measuringPage(hBrowser, "H");
      watch(hPage, "H", r);
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
        watch(page, `b${slot}`, r);
        await openDocument(page, doc);
        background.push({ client: `b${slot}`, page, block: blocks[2 + slot] });
      }

      const gBrowser = G_WS ? await chromium.connect(G_WS) : await chromium.launch(measuringLaunch());
      browsers.push(gBrowser);
      const gPage = await measuringPage(gBrowser, "G");
      watch(gPage, "G", r);
      const probe = OUTAGE ? await networkProbe(gPage, ["chat", "workspace"]) : null;
      memory = { H: await traceMemory(hBrowser), G: await traceMemory(gBrowser) };
      await gPage.goto("/join");
      await gPage.evaluate((expected) => (window as PerfWindow).__perfExpectJoin!(expected), { doc: SEED, count: USERS });
      await joinForm(gPage, "perf-G", PASSWORD);
      await expect.poll(() => gPage.evaluate(() => (window as PerfWindow).__perf?.some((e) => e.item === "003" && e.kind === "recv")), { timeout: 30_000 })
        .toBe(true).catch(() => r.notes.push({ at: now(), who: "G", phase: r.phase, kind: "join-timeout" }));
      if (!gPage.url().endsWith(`/documents/${doc}`)) await openDocument(gPage, doc);

      const h = { client: "H", page: hPage, block: blocks[0] };
      const g = { client: "G", page: gPage, block: blocks[1] };
      const actors = [h, g, ...background];
      await Promise.all(actors.map((actor) => online(actor.page, USERS)));
      await Promise.all(actors.map((actor) => expect.poll(() => blockValues(actor.page)).toEqual(seeds)));
      await Promise.all(actors.map((actor) => openChat(actor.page)));
      if (probe) await probe.ready();

      const clock: Note = { start: { H: await readClock(hPage), G: await readClock(gPage) } };
      r.phase = "window";
      const windowAt = now();
      if (OUTAGE) {
        await work(r, actors, MINUTES, 0);
        await outage(r, h, g, probe!, meta);
        await work(r, actors, MINUTES, 100);
      } else {
        await work(r, actors, MINUTES, 0);
        await present(r, h, g, blocks);
        await present(r, g, h, blocks);
      }
      await verify(r, actors);
      marks.push({ time: windowAt, timeEnd: now(), text: `round ${round}: measured window` });
      if (typeof meta.cutAt === "number") marks.push({ time: meta.cutAt, text: `round ${round}: cut` });
      if (typeof meta.restoreAt === "number") marks.push({ time: meta.restoreAt, text: `round ${round}: restore` });
      r.phase = "teardown";
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
      const [hEvents, gEvents, hMemory, gMemory, hAgent, gAgent] = await Promise.all([
        hPage.evaluate(() => (window as PerfWindow).__perf ?? []),
        gPage.evaluate(() => (window as PerfWindow).__perf ?? []),
        memory.H.stop(),
        memory.G.stop(),
        hPage.evaluate(() => navigator.userAgent),
        gPage.evaluate(() => navigator.userAgent),
      ]);
      memory = null;
      Object.assign(conditions, { browsers: { H: hBrowser.version(), G: gBrowser.version() }, userAgents: { H: hAgent, G: gAgent } });
      await Promise.all([
        write("conditions.json", JSON.stringify(conditions, null, 2)),
        write("clock.json", JSON.stringify(clock)),
        write("rtt.json", JSON.stringify(rtt)),
        write("events.jsonl", jsonl([...hEvents.map((e) => ({ device: "H", ...e })), ...gEvents.map((e) => ({ device: "G", ...e }))])),
        write("memory.jsonl", jsonl([...hMemory.map((s) => ({ device: "H", ...s })), ...gMemory.map((s) => ({ device: "G", ...s }))])),
      ]);
    } catch (error) {
      r.notes.push({ at: now(), who: "harness", phase: r.phase, kind: "aborted", message: String(error) });
      throw error;
    } finally {
      try {
        await Promise.all([write("signals.jsonl", jsonl(r.notes)), write("meta.json", JSON.stringify(meta)), write("plan.jsonl", jsonl(r.plan))]);
        await stats.stop();
      } finally {
        try {
          if (memory) await Promise.allSettled([memory.H.stop(), memory.G.stop()]);
          for (const browser of browsers) await browser.close().catch(() => {});
        } finally {
          // Before `stackDown`: a connected Prometheus keeps `compose down` from removing the network.
          if (observed) await detach(observed, marks).catch((error) => console.warn(`Round ${round}: detach failed: ${error}`));
          await stackDown(stack);
        }
      }
    }
  });
}
