/**
 * Spike watcher: attaches to a Yorkie document as a plain Node client, restores
 * it from git on start, and commits a YSON + markdown pair on a debounce.
 *
 * Yorkie runs on MemDB, so git is the only durable store — the restore path is
 * as load-bearing as the commit path. Run with `pnpm spike:watch [docKey]`.
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import yorkie, { type Document, type Tree } from '@yorkie-js/sdk';
import {
  buildDocFromYorkieTree,
  buildMarkMapping,
  invertMapping,
} from '@yorkie-js/prosemirror';
import { defaultMarkdownSerializer } from 'prosemirror-markdown';
import { pmSchema } from '../lib/pm-schema.ts';

const YORKIE_ADDR = process.env.YORKIE_ADDR ?? 'http://localhost:8080';
const DOC_KEY =
  process.argv[2] ??
  `pm-spike-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
const WORKSPACE = path.resolve('.data/workspace');
const DEBOUNCE_MS = 2000;

// The tree field the ProseMirror binding writes to (see app/spike/prosemirror).
const TREE_KEY = 'tree';

// A YSON document holding a single Tree. `yorkie.YSON.parse` would read this
// back, but its `Tree(...)` regex only matches three levels of nested braces
// (yorkie-js-sdk 0.7.13), so anything with a list throws. Slicing the wrapper
// off ourselves has no depth limit and leaves the file in the format the
// yorkie CLI accepts (`yorkie document create --initial-root`).
// ponytail: works because the document root holds nothing but this tree —
// swap in `yorkie.YSON.parse` once upstream's parser handles real nesting.
const YSON_PREFIX = `{"${TREE_KEY}":Tree(`;
const YSON_SUFFIX = ')}';

const exec = promisify(execFile);
const git = (...args: Array<string>) => exec('git', args, { cwd: WORKSPACE });
const log = (line: string) =>
  console.log(`${new Date().toISOString().slice(11, 23)} ${line}`);

const elementToMark = invertMapping(buildMarkMapping(pmSchema));
const ysonPath = path.join(WORKSPACE, `${DOC_KEY}.yson`);
const mdPath = path.join(WORKSPACE, `${DOC_KEY}.md`);

async function ensureWorkspace() {
  await mkdir(WORKSPACE, { recursive: true });
  // Not `git rev-parse` — this directory sits inside the app's own repository,
  // so that would happily report the parent one.
  if (!existsSync(path.join(WORKSPACE, '.git'))) {
    await git('init', '-b', 'main');
    log(`git init ${WORKSPACE}`);
  }
}

/** The tree stored for this document key, or undefined on a cold workspace. */
async function restoreTree() {
  const text = await readFile(ysonPath, 'utf8').catch(() => null);
  if (!text) return undefined;

  const root = JSON.parse(text.slice(YSON_PREFIX.length, -YSON_SUFFIX.length));
  log(`restored ${DOC_KEY}.yson (${text.length} bytes)`);
  return new yorkie.Tree(root);
}

async function flush(doc: Document<{ tree: Tree }>) {
  const tree = doc.getRoot()[TREE_KEY];
  if (!tree) return;

  const t0 = performance.now();
  const yson = YSON_PREFIX + tree.toJSON() + YSON_SUFFIX;
  const t1 = performance.now();
  const markdown = defaultMarkdownSerializer.serialize(
    buildDocFromYorkieTree(tree, pmSchema, elementToMark),
  );
  const t2 = performance.now();

  await writeFile(ysonPath, yson);
  await writeFile(mdPath, markdown + '\n');
  await git('add', '--all');
  // Let git decide whether anything actually changed; `git commit` on a clean
  // index exits non-zero and we would have to tell that apart from a failure.
  const { stdout } = await git('status', '--porcelain');
  if (!stdout.trim()) {
    log(`no change — skipped (yson ${(t1 - t0).toFixed(1)}ms)`);
    return;
  }
  await git('commit', '-m', `edit(${DOC_KEY}): ${new Date().toISOString()}`);
  const t3 = performance.now();

  log(
    `committed — yson ${(t1 - t0).toFixed(1)}ms, md ${(t2 - t1).toFixed(1)}ms, git ${(t3 - t2).toFixed(1)}ms`,
  );
}

await ensureWorkspace();

const client = new yorkie.Client({ rpcAddr: YORKIE_ADDR });
await client.activate();
const doc = new yorkie.Document<{ tree: Tree }>(DOC_KEY);

const tree = await restoreTree();
// `initialRoot` only fills fields the document lacks, so this is a no-op while
// Yorkie still holds the document and a restore after Yorkie has been wiped.
await client.attach(doc, tree ? { initialRoot: { tree } } : {});
log(`attached to ${DOC_KEY} at ${YORKIE_ADDR}`);

let timer: NodeJS.Timeout | undefined;
let queue = Promise.resolve();
doc.subscribe(() => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    // Serialised: two `git` runs overlapping in one repository fight over
    // index.lock.
    queue = queue.then(() => flush(doc)).catch((e) => log(`ERROR ${e}`));
  }, DEBOUNCE_MS);
});

log(`watching — debounce ${DEBOUNCE_MS}ms, workspace ${WORKSPACE}`);
