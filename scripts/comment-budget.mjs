#!/usr/bin/env node
// Comment ratio for .ts/.tsx files changed against the merge base. A routing
// signal, not a gate: exceeding the threshold means "this file's comments
// outgrew the file — move the rationale to docs/", not "fix this before you
// can commit." See docs/conventions.md for what may stay inline.
//
// Always exits 0. Pass --strict to make an over-threshold file a real
// failure — that flag is for the promotion this script earns on
// COMMENT_BUDGET_PROMOTION_DATE (scripts/lib/promotion-date.mjs), not for
// day-to-day use; nothing wires it in yet.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { promotionNotice } from "./lib/promotion-date.mjs";

const THRESHOLD = 0.25;

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

// Locally `origin` is this repo's fork and `upstream` is canonical; in CI,
// `origin` *is* canonical (GitHub Actions checks out the workflow's own repo
// under that name). Trying both in this order gets the right base in both
// places without hardcoding either.
function resolveMergeBase() {
  for (const ref of ["upstream/main", "origin/main", "main"]) {
    try {
      git(["rev-parse", "--verify", "--quiet", ref]);
    } catch {
      continue;
    }
    try {
      return git(["merge-base", ref, "HEAD"]);
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
  return total === 0 ? null : comment / total;
}

// Working-tree content — what `HEAD` already has, plus any committed-but-not-
// pushed history the diff below walks past. Used when comparing base..HEAD.
function ratioForCommitted(path) {
  let source;
  try {
    source = readFileSync(path, "utf8");
  } catch {
    return null; // deleted in this diff — nothing to measure
  }
  return ratioFromSource(source);
}

// The *staged* version of a file — `git show :path` reads the index, not the
// working tree. Needed for pre-commit: at that point the change being
// measured has not reached HEAD yet, so diffing base..HEAD would miss it
// entirely and silently check a stale, already-committed diff instead.
function ratioForStaged(path) {
  let source;
  try {
    source = git(["show", `:${path}`]);
  } catch {
    return null; // deleted in the index — nothing to measure
  }
  return ratioFromSource(source);
}

export function run({ strict = false, staged = false, base = resolveMergeBase() } = {}) {
  if (!base) {
    return { base: null, over: [], strict, failed: false };
  }
  const diffArgs = staged
    ? ["diff", "--name-only", "--diff-filter=ACMR", "--cached", base, "--", "*.ts", "*.tsx"]
    : ["diff", "--name-only", "--diff-filter=ACMR", base, "HEAD", "--", "*.ts", "*.tsx"];
  const changed = git(diffArgs).split("\n").filter(Boolean);
  const ratioFor = staged ? ratioForStaged : ratioForCommitted;

  const over = [];
  for (const path of changed) {
    const ratio = ratioFor(path);
    if (ratio !== null && ratio > THRESHOLD) over.push({ path, ratio });
  }

  return { base, over, strict, failed: strict && over.length > 0 };
}

function main() {
  const strict = process.argv.includes("--strict");
  const staged = process.argv.includes("--staged");
  const { base, over, failed } = run({ strict, staged });

  if (base === null) {
    console.log("No merge base found (upstream/main, origin/main, main all unavailable) — skipping.");
    process.exitCode = 0;
    return;
  }

  if (over.length === 0) {
    console.log(`Comment budget clean against ${base} — no changed .ts/.tsx file exceeds ${THRESHOLD * 100}%.`);
  } else {
    console.log(`Files over the ${THRESHOLD * 100}% comment budget (move this to docs/, not a failure):`);
    for (const { path, ratio } of over) {
      console.log(`  ${(ratio * 100).toFixed(1)}%  ${path}`);
    }
  }

  const notice = promotionNotice();
  if (notice) console.log(`\n${notice}`);

  process.exitCode = failed ? 1 : 0;
}

import { pathToFileURL } from "node:url";
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
