import { YSON } from "@yorkie-js/sdk";

import { readBlocks } from "./document.ts";
import type { ReadableBlock } from "./document.ts";
import type { Block } from "./types.ts";

/** Reads a Yorkie revision's YSON snapshot into blocks, for a read-only preview
 *  and as the source a restore writes back. Why the app restores instead of
 *  calling `restoreRevision`: `docs/design/version-history.md`. */

/** One `yorkie.Text` node as the snapshot spells it. */
type SnapshotTextNode = { val?: unknown };

/**
 * Undoes `YSON.parse`'s CRDT-typed wrappers, so the rest of this file can read
 * the result as plain JSON.
 *
 * Uses the SDK's own `YSON.isInt`/`isLong`/`isText`/`isObject` guards rather
 * than checking `.type` by hand, so this can't be confused by an ordinary
 * stored block that also has a `type` field (e.g. `{ id, type: "text",
 * content }` — `isObject` already excludes every wrapper shape, this one
 * included). `lib/blocks/types.ts`'s `Block` union never stores a `Tree`,
 * `Date`, `BinData`, `Counter` or `DedupCounter` value, so those wrapper kinds
 * are left unhandled on purpose: a value of one of those kinds passes through
 * un-recursed rather than guessing at an unwrap this schema never exercises.
 */
function unwrapYson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(unwrapYson);
  if (YSON.isInt(value) || YSON.isLong(value)) return value.value;
  if (YSON.isText(value)) return unwrapYson(value.nodes);
  if (!YSON.isObject(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, val]) => [key, unwrapYson(val)]),
  );
}

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
  const parsed = unwrapYson(YSON.parse(snapshot));
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
