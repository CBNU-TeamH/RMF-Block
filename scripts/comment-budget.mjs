#!/usr/bin/env node
// Comment ratio for .ts/.tsx files changed against the merge base, for files
// past SMALL_FILE_FLOOR — smaller ones are exempt (see docs/conventions.md,
// "the real floor is content, and it binds on small files only"). Exceeding the
// threshold means "this file's comments outgrew the file — move the rationale
// to docs/". See docs/conventions.md for what may stay inline.
//
// Exits 0 by default. CI runs it with --strict, which fails only the files this
// change made worse (see `worsenedAgainst`) — and fails outright when there is
// no merge base, since a gate that cannot see its base would pass everything.

import { execFileSync } from "node:child_process";

// Arafat & Riehle (ICSE 2009 NIER) measured 5,229 active open source projects on this exact
// definition — comment lines over comment+source lines — and found mean 18.67%, median 16.74%.
// This repo's own median is 20.0%. A 25% threshold therefore sat at our p75 and at roughly the
// top third of open source generally: it cut through the middle of ordinary code rather than
// separating anything. 30% is the first point clearly outside the pack.
const THRESHOLD = 0.3;
// #75: below this many code lines the ratio fails regardless of quality — measured against the
// then-25% budget (docs/conventions.md, "the real floor is content, and it binds on small files
// only"): 0% of files over this line failed after #74's cleanup; 76-88% of files at or under it
// did. Exempt them rather than asking every small file's author to re-argue the same case per PR.
// The same effect is in the paper above: commits under 100 source lines average 25.1% density,
// converging to 22.2% by 80-100 lines — small bodies are structurally comment-dense.
const SMALL_FILE_FLOOR = 40;

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

// Swallows stderr for calls whose failure is expected control flow (a ref that
// doesn't exist yet, a path absent at that revision) — the caller's catch
// already explains the case, so git's own "fatal:" line would just be noise.
function gitQuiet(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

// Locally `origin` is this repo's fork and `upstream` is canonical; in CI,
// `origin` *is* canonical (GitHub Actions checks out the workflow's own repo
// under that name). Trying both in this order gets the right base in both
// places without hardcoding either.
function resolveMergeBase() {
  for (const ref of ["upstream/main", "origin/main", "main"]) {
    try {
      gitQuiet(["rev-parse", "--verify", "--quiet", ref]);
    } catch {
      continue;
    }
    try {
      return gitQuiet(["merge-base", ref, "HEAD"]);
    } catch {
      continue;
    }
  }
  return null;
}

// Line-based comment counter: a `//` line, or lines inside a `/* */` block,
// count as comment; everything else non-blank counts as code. Doesn't need to
// parse strings or template literals — this is the same measure used to size
// the problem throughout this whole effort (see docs/conventions.md), not a
// new metric.
function ratioFromSource(source) {
  let code = 0;
  let comment = 0;
  let inBlock = false;
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (inBlock) {
      comment++;
      if (line.includes("*/")) inBlock = false;
      continue;
    }
    if (line === "") continue;
    if (line.startsWith("//")) {
      comment++;
    } else if (line.startsWith("/*")) {
      comment++;
      if (!line.includes("*/")) inBlock = true;
    } else {
      code++;
    }
  }
  const total = code + comment;
  return total === 0 ? null : { code, comment, ratio: comment / total };
}

// A file's ratio at a given revision — `git show rev:path`. Returns null when
// the path doesn't exist there (deleted, or not yet born at that revision).
function ratioAt(rev, path) {
  let source;
  try {
    source = gitQuiet(["show", `${rev}:${path}`]);
  } catch {
    return null;
  }
  return ratioFromSource(source);
}

// The committed content at HEAD, not the working tree, so an uncommitted edit
// sitting on top of a committed file can't leak into a base..HEAD comparison.
function ratioForCommitted(path) {
  return ratioAt("HEAD", path); // null: deleted in this diff — nothing to measure
}

// The *staged* version of a file — `git show :path` reads the index, not the
// working tree. Needed for pre-commit: at that point the change being
// measured has not reached HEAD yet, so diffing base..HEAD would miss it
// entirely and silently check a stale, already-committed diff instead.
function ratioForStaged(path) {
  return ratioAt("", path); // null: deleted in the index — nothing to measure
}

/** Whether this change is what pushed the file over, rather than inheriting a
 *  file that was already over. Both conditions are needed: the ratio alone
 *  rises when code is deleted and no comment is touched, and deleting code is
 *  what `AGENTS.md` §3 asks for — it must not fail the gate. A file absent from
 *  the base is new, so the budget applies to it in full. */
function worsenedAgainst(base, path, measured) {
  const before = ratioAt(base, path);
  if (before === null) return true;
  return measured.ratio > before.ratio && measured.comment > before.comment;
}

export function run({ strict = false, staged = false, base = resolveMergeBase() } = {}) {
  if (!base) {
    return { base: null, over: [], strict, failed: strict };
  }
  const diffArgs = staged
    ? ["diff", "--name-only", "--diff-filter=ACMR", "--cached", base, "--", "*.ts", "*.tsx"]
    : ["diff", "--name-only", "--diff-filter=ACMR", base, "HEAD", "--", "*.ts", "*.tsx"];
  const changed = git(diffArgs).split("\n").filter(Boolean);
  const ratioFor = staged ? ratioForStaged : ratioForCommitted;

  const over = [];
  for (const path of changed) {
    const measured = ratioFor(path);
    if (measured === null || measured.code <= SMALL_FILE_FLOOR) continue;
    if (measured.ratio <= THRESHOLD) continue;
    // Still reported either way — the routing signal is "this file's comments
    // outgrew it", which is true of an inherited one too. Only the gate ratchets.
    over.push({ path, ratio: measured.ratio, worsened: worsenedAgainst(base, path, measured) });
  }

  return { base, over, strict, failed: strict && over.some((file) => file.worsened) };
}

function main() {
  const strict = process.argv.includes("--strict");
  const staged = process.argv.includes("--staged");
  const { base, over, failed } = run({ strict, staged });

  if (base === null) {
    console.log(
      `No merge base found (upstream/main, origin/main, main all unavailable) — ${strict ? "failing under --strict" : "skipping"}.`,
    );
    process.exitCode = failed ? 1 : 0;
    return;
  }

  if (over.length === 0) {
    console.log(`Comment budget clean against ${base} — no changed .ts/.tsx file exceeds ${THRESHOLD * 100}%.`);
  } else {
    console.log(`Files over the ${THRESHOLD * 100}% comment budget (move the rationale to docs/):`);
    for (const { path, ratio, worsened } of over) {
      console.log(`  ${(ratio * 100).toFixed(1)}%  ${path}${worsened ? "" : "  (inherited — --strict lets this pass)"}`);
    }
  }

  process.exitCode = failed ? 1 : 0;
}

import { pathToFileURL } from "node:url";
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
