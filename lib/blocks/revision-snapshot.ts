import { readBlocks } from "./document.ts";
import type { ReadableBlock } from "./document.ts";
import type { Block } from "./types.ts";

/** Reads a Yorkie revision's YSON snapshot into blocks, for a read-only preview
 *  and as the source a restore writes back. Why this exists rather than
 *  `yorkie.YSON.parse`, and why the app restores instead of calling
 *  `restoreRevision`: `docs/design/version-history.md`. */

/** The CRDT wrappers YSON puts around a value. Each holds JSON inside its
 *  parentheses, so dropping the wrapper leaves something `JSON.parse` reads.
 *  `Counter` trails `DedupCounter` because the shorter name is a prefix match. */
const WRAPPERS = [
  "Text(",
  "Tree(",
  "Int(",
  "Long(",
  "Date(",
  "BinData(",
  "DedupCounter(",
  "Counter(",
];

/**
 * YSON to JSON, tracking string literals.
 *
 * That tracking is the whole point. Yorkie's own parser matches these wrappers
 * with regexes that cannot tell a `)` in someone's file name from the one that
 * closes `Text(`, which is why a snapshot containing `보고서 (최종).pdf` survives
 * the server's own restore as `보고서 (최종}.pdf`, and why one unbalanced `]` in a
 * paragraph makes `YSON.parse` throw.
 */
export function ysonToJson(yson: string): string {
  let out = "";
  let inString = false;
  let depth = 0;
  // The paren depth each open wrapper sits at, so its closing paren is the one
  // dropped and any other `)` is kept.
  const wrappers: Array<number> = [];

  for (let index = 0; index < yson.length; index += 1) {
    const character = yson[index];

    if (inString) {
      out += character;
      if (character === "\\") {
        out += yson[index + 1] ?? "";
        index += 1;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      out += character;
      continue;
    }

    const wrapper = WRAPPERS.find((name) => yson.startsWith(name, index));
    if (wrapper) {
      depth += 1;
      wrappers.push(depth);
      index += wrapper.length - 1;
      continue;
    }

    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      if (wrappers[wrappers.length - 1] === depth) {
        wrappers.pop();
        depth -= 1;
        continue;
      }
      depth -= 1;
    }

    out += character;
  }

  return out;
}

/** One `yorkie.Text` node as the snapshot spells it. */
type SnapshotTextNode = { val?: unknown };

/**
 * A snapshot's blocks, in the shape the editor already renders.
 *
 * `content.text` arrives as the nodes of a `yorkie.Text` and flattens to the
 * string `readBlocks` reads out through `toString()` — a plain string answers
 * that call with itself, so no `Text` has to be built to read one. Per-block
 * resilience is `readBlocks`'s, unchanged: a snapshot is network input and
 * `docs/design/api.md` §2 trusts none of it.
 */
export function readRevisionBlocks(snapshot: string): Array<Block> {
  const parsed: unknown = JSON.parse(ysonToJson(snapshot));
  const blocks = (parsed as { blocks?: unknown })?.blocks;
  if (!Array.isArray(blocks)) return [];

  return readBlocks(blocks.map(flattenText).filter(hasUsableId()));
}

/**
 * Drops entries whose `id` cannot address a block.
 *
 * `readBlocks` copies an `id` through without looking at it, and a restore then
 * writes these straight into the live document — where the id is the only
 * handle anything has. A missing or non-string one leaves a block nothing can
 * reach; a duplicate is worse, because `editBlockText` resolves by id and would
 * quietly pour the second block's text into the first. Returns a fresh
 * predicate per call so the `seen` set cannot leak between snapshots.
 */
function hasUsableId(): (block: ReadableBlock | null) => block is ReadableBlock {
  const seen = new Set<string>();

  return (block): block is ReadableBlock => {
    if (!block || typeof block.id !== "string" || block.id === "") return false;
    if (seen.has(block.id)) return false;

    seen.add(block.id);
    return true;
  };
}

function flattenText(stored: unknown): ReadableBlock | null {
  if (!stored || typeof stored !== "object") return null;

  const block = stored as ReadableBlock & { content?: { text?: unknown } };
  const nodes = block.content?.text;
  if (!Array.isArray(nodes)) return block;

  const text = (nodes as Array<SnapshotTextNode>)
    .map((node) => (typeof node?.val === "string" ? node.val : ""))
    .join("");

  return { ...block, content: { ...block.content, text } };
}
