/**
 * Checks that the SDK behaviours our document schema is built on still hold.
 *
 *   node scripts/verify-yorkie-invariants.mjs
 *
 * Needs Yorkie running (the app is not involved). Defaults to compose:
 *
 *   RPC=http://localhost:8080
 *
 * This is issue #42's harness. `docs/adr/007-block-array-not-tree.md` measured
 * four properties by hand and then said, in its own Consequences: "the
 * verification numbers above are load-bearing and unprotected by CI." The
 * 0.7.13 → 0.7.23 bump proved the point — every unit test passed while two
 * unrelated SDK behaviours changed underneath them, because nothing in the
 * suite reaches a real server.
 *
 * **A failure here is not a bug in this repository.** It means the SDK stopped
 * behaving the way a decision was made against, so go re-read ADR-007 before
 * changing anything. Case ④ is deliberately an assertion that something is
 * still *broken*: re-parenting a CRDT loses data silently, and `toStoredBlock`
 * builds a new `Text` per block rather than moving one because of it. If
 * upstream ever fixes that, this fails and the comment explaining the
 * workaround can come out.
 *
 * Every case prints what it expected and what happened, and the process exits
 * non-zero if any of them disagree.
 */
import yorkie from "@yorkie-js/sdk";

import { createReporter, requireReachable } from "./lib/verify-report.mjs";

const RPC = process.env.RPC ?? "http://localhost:8080";

const reporter = createReporter();
const { report } = reporter;

await requireReachable([["Yorkie", `${RPC}/yorkie.v1.YorkieService/health`]]);

async function admin(method, body, token) {
  const response = await fetch(`http://${new URL(RPC).host}/yorkie.v1.AdminService/${method}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${response.status} ${text}`);
  return JSON.parse(text);
}

// A throwaway project, not the app's: the app's carries the auth webhook, and
// these cases are about the SDK's own behaviour rather than about who may
// attach. A fresh one also means no leftover document can affect a result.
const { token } = await admin("LogIn", { username: "admin", password: "admin" });
const { project } = await admin(
  "CreateProject",
  { name: `inv${Date.now().toString().slice(-9)}` },
  token,
);
const apiKey = project.publicKey;

const clients = [];
async function client() {
  const created = new yorkie.Client({ rpcAddr: RPC, apiKey });
  await created.activate();
  clients.push(created);
  return created;
}

// Yorkie pushes changes to watchers rather than answering a read, so a peer's
// edit lands a moment after the sync that sent it. Every wait in here is this
// one function — if a case ever needs "just a bit longer", that is a result.
const settle = () => new Promise((resolve) => setTimeout(resolve, 600));

/** A block the way `lib/blocks/document.ts` stores one. */
const block = (id) => ({ id, type: "text", content: { text: new yorkie.Text() } });
const textsOf = (doc) => doc.getRoot().blocks.map((b) => b.content.text.toString());
const idsOf = (doc) => doc.getRoot().blocks.map((b) => b.id).join(",");

/** The setup every two-client case below starts from: two fresh clients on
 *  the same document key, `seed` building `dA`'s side, then `dB` brought up
 *  to date with it. Cases ①–③ differ only in what `seed` does and what they
 *  assert afterward. */
async function twoClientsSeeded(key, seed) {
  const [a, b] = await Promise.all([client(), client()]);
  const dA = new yorkie.Document(key);
  const dB = new yorkie.Document(key);
  await a.attach(dA);
  await seed(dA);
  await a.sync();
  await settle();
  await b.attach(dB);
  await settle();
  return { a, b, dA, dB };
}

/** Publishes both clients' pending local changes and lets each round trip to
 *  the other. Twice because a `sync()` publishes but does not wait for the
 *  peer to receive it — the second pass is what the peer's own sync answers. */
async function syncBothTwice(a, b) {
  await Promise.all([a.sync(), b.sync()]);
  await settle();
  await Promise.all([a.sync(), b.sync()]);
  await settle();
}

console.log("\n① 배열 안에 중첩된 yorkie.Text 는 살아 있는 CRDT다");
{
  const key = `inv-nested-${Date.now()}`;
  const { a, b, dA, dB } = await twoClientsSeeded(key, async (dA) => {
    dA.update((root) => {
      root.blocks = [block("b1"), block("b2"), block("b3")];
    });
    // A second call: a `Text` cannot be edited in the same update that creates it.
    dA.update((root) => {
      root.blocks[0].content.text.edit(0, 0, "first");
      root.blocks[1].content.text.edit(0, 0, "second");
      root.blocks[2].content.text.edit(0, 0, "third");
    });
  });

  // The attach is the case: a second client must receive a working `Text`,
  // not an inert JSON object. wafflebase carries a warning that a nested
  // `Tree` degrades exactly that way.
  report("두 번째 클라이언트가 Text 를 받는다", "first", textsOf(dB)[0]);

  dB.update((root) => {
    root.blocks[0].content.text.edit(5, 5, "-from-B");
  });
  await b.sync();
  await settle();
  await a.sync();
  await settle();
  report("중첩된 Text 로의 edit() 가 전파된다", true, textsOf(dA)[0].includes("-from-B"));

  // A cold client reads the merged result, rather than either side's view.
  const c = await client();
  const dC = new yorkie.Document(key);
  await c.attach(dC);
  await settle();
  report("나중에 붙은 클라이언트가 병합 결과를 읽는다", textsOf(dA)[0], textsOf(dC)[0]);
}

console.log("\n② 동시 moveAfter 가 수렴한다 (yorkie-team/yorkie#676)");
{
  const { a, b, dA, dB } = await twoClientsSeeded(`inv-move-${Date.now()}`, async (dA) => {
    dA.update((root) => {
      root.blocks = [block("m1"), block("m2"), block("m3")];
    });
  });

  // Each side's reference element is the element the other is moving — the
  // shape #676 reported as non-converging.
  dA.update((root) => {
    root.blocks.moveAfter(root.blocks.getElementByIndex(2).getID(), root.blocks.getElementByIndex(0).getID());
  });
  dB.update((root) => {
    root.blocks.moveAfter(root.blocks.getElementByIndex(0).getID(), root.blocks.getElementByIndex(2).getID());
  });
  await syncBothTwice(a, b);

  report("양쪽이 같은 순서로 수렴한다", idsOf(dA), idsOf(dB));
  report("블록이 사라지지 않는다", 3, dA.getRoot().blocks.length);
}

console.log("\n③ 이동이 옮겨진 블록의 텍스트를 보존한다 (동시 편집 포함)");
{
  const { a, b, dA, dB } = await twoClientsSeeded(`inv-keep-${Date.now()}`, async (dA) => {
    dA.update((root) => {
      root.blocks = [block("k1"), block("k2"), block("k3")];
    });
    dA.update((root) => {
      root.blocks[0].content.text.edit(0, 0, "moved");
    });
  });

  // A moves the block to the end while B types into that same block. This is
  // the property `Tree` cannot offer while `move` is unimplemented — FR-022-04.
  dA.update((root) => {
    root.blocks.moveAfter(root.blocks.getElementByIndex(2).getID(), root.blocks.getElementByIndex(0).getID());
  });
  dB.update((root) => {
    root.blocks[0].content.text.edit(5, 5, "-typed");
  });
  await syncBothTwice(a, b);

  report("이동 후 순서가 수렴한다", idsOf(dA), idsOf(dB));
  report("옮겨진 블록의 텍스트가 남아 있다", true, textsOf(dA).some((t) => t.startsWith("moved")));
  report("동시에 친 글자가 살아남는다", true, textsOf(dA).some((t) => t.includes("-typed")));
}

console.log("\n④ CRDT 는 재배치할 수 없고, 실패가 조용하다 (여전히 깨져 있어야 정상)");
{
  const a = await client();
  const doc = new yorkie.Document(`inv-reparent-${Date.now()}`);
  await a.attach(doc);
  doc.update((root) => {
    root.source = { text: new yorkie.Text() };
  });
  doc.update((root) => {
    root.source.text.edit(0, 0, "이 글자는 옮겨지지 않는다");
  });
  await a.sync();
  await settle();

  let threw = false;
  try {
    doc.update((root) => {
      root.destination = { text: root.source.text };
    });
  } catch {
    threw = true;
  }
  await a.sync();
  await settle();

  report("예외 없이 넘어간다", false, threw);
  report("옮긴 곳의 Text 는 비어 있다", "", doc.getRoot().destination?.text?.toString?.());
}

console.log("\n⑤ undo 가 로컬 변경을 되돌린다");
{
  const a = await client();
  const doc = new yorkie.Document(`inv-undo-${Date.now()}`);
  await a.attach(doc);
  doc.update((root) => {
    root.blocks = [block("u1")];
  });
  doc.update((root) => {
    root.blocks[0].content.text.edit(0, 0, "before");
  });
  await a.sync();
  await settle();

  // `use-block-document.ts` reads this to floor the stack at the seed, so it
  // has to keep existing and keep counting.
  const floor = doc.getUndoStackForTest().length;
  doc.update((root) => {
    root.blocks.push(block("u2"));
  });
  await a.sync();
  await settle();

  report("스택이 변경마다 깊어진다", true, doc.getUndoStackForTest().length > floor);
  report("canUndo 가 참이다", true, doc.history.canUndo());

  doc.history.undo();
  await settle();
  report("undo 가 추가된 블록을 되돌린다", 1, doc.getRoot().blocks.length);

  doc.history.redo();
  await settle();
  report("redo 가 다시 적용한다", 2, doc.getRoot().blocks.length);
}

for (const created of clients) {
  await created.deactivate().catch(() => undefined);
}

console.log(
  reporter.failures === 0
    ? "\n  모두 기대대로입니다 — ADR-007 의 전제가 이 버전에서도 유효합니다.\n"
    : `\n  ${reporter.failures}건이 기대와 다릅니다. SDK 동작이 바뀌었다는 뜻이므로,` +
        " 코드를 고치기 전에 docs/adr/007-block-array-not-tree.md 를 다시 읽으십시오.\n",
);

process.exit(reporter.failures === 0 ? 0 : 1);
