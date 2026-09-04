#!/usr/bin/env node
// Run before starting work (AGENTS.md §2, step 0) and whenever the docs might
// have drifted. Checks four things:
//
//   (a) doc ownership — via verify-doc-ownership.mjs. Fails on a dead
//       reference, a duplicate claim, or a doc missing its Owns line. Coverage
//       holes are printed but don't fail this either, for the same reason
//       they don't fail the ownership checker on its own.
//   (b) task index freshness — tasks/README.md and tasks/archive/README.md
//       are generated from tasks/active/ and tasks/archive/ (scripts/tasks-index.sh).
//       Report only, never auto-mutate a tracked file — if they're stale, say
//       so and name the command to fix it.
//   (c) dead links — every markdown link and backtick-quoted repo-relative
//       path inside docs/**/*.md, AGENTS.md, and tasks/active/*.md actually
//       exists on disk. Anchors and external URLs are skipped.
//   (d) the comment-budget promotion notice, shared with comment-budget.mjs.
//
// Exit 1 if (a) or (c) fail. (b) and (d) are informational.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { checkOwnership } from "./verify-doc-ownership.mjs";
import { promotionNotice } from "./lib/promotion-date.mjs";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([a-zA-Z]):/, "$1:");

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function checkOwnershipSection() {
  const { unowned, deadReferences, duplicates, missingOwnsLine } = checkOwnership();
  const failed = deadReferences.length > 0 || duplicates.length > 0 || missingOwnsLine.length > 0;
  const lines = [];
  if (missingOwnsLine.length > 0) {
    lines.push("No **Owns** line found:");
    for (const doc of missingOwnsLine) lines.push(`  ${doc}`);
  }
  if (deadReferences.length > 0) {
    lines.push("Dead ownership references:");
    for (const { doc, claim } of deadReferences) lines.push(`  ${doc} -> ${claim}`);
  }
  if (duplicates.length > 0) {
    lines.push("Duplicate ownership claims:");
    for (const { unit, docs } of duplicates) lines.push(`  ${unit} <- ${docs.join(", ")}`);
  }
  if (unowned.length > 0) {
    lines.push(`(${unowned.length} coverage hole(s) — not blocking, see verify-doc-ownership.mjs)`);
  }
  return { name: "Doc ownership", failed, lines };
}

// Regenerates into memory (not onto disk) and diffs against what's committed,
// so this never mutates a tracked file — only `pnpm tasks:index` does that,
// on purpose.
function checkTaskIndexFreshness() {
  let stdout;
  try {
    // tasks-index.sh always writes to the real paths; there's no dry-run
    // flag. Snapshot current content, run it, diff, then restore if it
    // changed — the check's job is to report drift, not fix it.
    const targets = ["tasks/README.md", "tasks/archive/README.md"];
    const before = targets.map((t) => {
      try {
        return readFileSync(join(ROOT, t), "utf8");
      } catch {
        return null;
      }
    });
    execFileSync("bash", ["scripts/tasks-index.sh"], { cwd: ROOT, stdio: "pipe" });
    const after = targets.map((t) => readFileSync(join(ROOT, t), "utf8"));
    const stale = targets.filter((_, i) => before[i] !== after[i]);
    stdout = { stale, targets, before };
    // Restore whatever this check changed — verify-docs only reports.
    for (let i = 0; i < targets.length; i++) {
      if (before[i] !== null && stale.includes(targets[i])) {
        execFileSync("git", ["checkout", "--", targets[i]], { cwd: ROOT, stdio: "pipe" });
      }
    }
  } catch (err) {
    return { name: "Task index freshness", failed: false, lines: [`Could not run tasks-index.sh: ${err.message}`] };
  }
  if (stdout.stale.length === 0) {
    return { name: "Task index freshness", failed: false, lines: [] };
  }
  return {
    name: "Task index freshness",
    failed: false,
    lines: [
      `Stale: ${stdout.stale.join(", ")}`,
      `Run \`pnpm tasks:index\` and commit the result.`,
    ],
  };
}

const MD_LINK = /\]\(([^)]+)\)/g;
// Backtick-quoted text that plausibly names a repo file: a slash, and either
// a recognized source/doc extension or a trailing slash (a directory claim,
// matching how the design docs write their **Owns** lines).
const BACKTICK_PATH =
  /`((?:[a-zA-Z0-9_.-]+\/)+[a-zA-Z0-9_.\[\]()-]+\.(?:ts|tsx|mts|js|mjs|md|json|ya?ml|sh|go)|(?:[a-zA-Z0-9_.-]+\/)+)`/g;

// `.data/` is this app's runtime state directory (ADR-002) — created at
// runtime, gitignored, genuinely absent from a checkout, and mentioned in
// docs precisely because it isn't tracked. `packages/` isn't a directory
// this single-package repo has at all; every mention is a path into
// `@yorkie-js/sdk`'s own internal layout, quoted for illustration. Neither
// is a broken reference — checking either would mean resolving into a
// vendored dependency's version-specific internals, a different question
// from "is our own doc reference broken."
const EXCLUDED_PREFIXES = [".data/", "packages/"];

// AGENTS.md's own workflow table, and this repo's task-naming convention,
// both use YYYY/MM/DD-shaped placeholders in prose — not a path anyone
// expects to resolve.
const PLACEHOLDER = /\b(YYYY|MM|DD)\b/;

function isSkippable(path) {
  return (
    path === "" ||
    path.startsWith("#") ||
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("mailto:") ||
    EXCLUDED_PREFIXES.some((p) => path.startsWith(p)) ||
    PLACEHOLDER.test(path)
  );
}

// Markdown link targets: real hyperlinks a reader can click, so every scanned
// file's links get checked, and standard markdown resolution applies — no
// leading `./`/`../` still means "relative to this file", not "relative to
// the repo root". Confirmed against docs/adr/*.md, which link each other by
// bare filename and broke under an earlier, ROOT-first version of this rule.
function extractMarkdownLinks(text) {
  const found = [];
  for (const match of text.matchAll(MD_LINK)) {
    const [pathPart] = match[1].split("#");
    if (isSkippable(match[1])) continue;
    found.push({ path: pathPart, rootRelative: pathPart.startsWith("/") });
  }
  return found;
}

// Backtick-quoted prose mentions: not real hyperlinks, so they resolve from
// the repo root by this project's own writing convention (`lib/x.ts`,
// `docs/y.md`). Only scanned in docs/ and AGENTS.md — tasks/active/*.md's
// prose routinely names paths for rejected alternatives, prior-art spikes,
// and not-yet-built proposals (confirmed: the 2026-08-25..09 task docs are
// full of these), which are not broken references, just planning text.
function extractBacktickPaths(text) {
  const found = [];
  for (const match of text.matchAll(BACKTICK_PATH)) {
    if (isSkippable(match[1])) continue;
    found.push({ path: match[1], rootRelative: true });
  }
  return found;
}

// docs/ui/ is excluded the same way eslint.config.mjs excludes it: wireframe
// blueprints and a vendored runtime nobody here owns, where every mention of
// a since-removed export/uploads/ path is *documenting* what was
// deliberately left out of the repo, not a broken reference to fix.
function listMarkdownFiles(dir) {
  const files = [];
  function walk(d) {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      if (relative(ROOT, full).replaceAll("\\", "/").startsWith("docs/ui/")) continue;
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith(".md")) files.push(full);
    }
  }
  walk(dir);
  return files;
}

function resolveCandidate(fileDir, { path, rootRelative }) {
  if (rootRelative) return resolve(ROOT, path.replace(/^\//, ""));
  return resolve(fileDir, path);
}

function checkDeadLinks() {
  const docsFiles = listMarkdownFiles(join(ROOT, "docs"));
  const activeFiles = readdirSync(join(ROOT, "tasks", "active"))
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(ROOT, "tasks", "active", f));
  const agentsFile = join(ROOT, "AGENTS.md");

  const broken = [];

  // Markdown-link syntax: checked everywhere, real hyperlinks either way.
  for (const file of [...docsFiles, agentsFile, ...activeFiles]) {
    const text = readFileSync(file, "utf8");
    const dir = dirname(file);
    for (const candidate of extractMarkdownLinks(text)) {
      const target = resolveCandidate(dir, candidate);
      if (!existsSync(target)) {
        broken.push({ file: relative(ROOT, file), candidate: candidate.path });
      }
    }
  }

  // Backtick-quoted prose: only docs/ and AGENTS.md — see extractBacktickPaths.
  for (const file of [...docsFiles, agentsFile]) {
    const text = readFileSync(file, "utf8");
    const dir = dirname(file);
    for (const candidate of extractBacktickPaths(text)) {
      const target = resolveCandidate(dir, candidate);
      if (!existsSync(target)) {
        broken.push({ file: relative(ROOT, file), candidate: candidate.path });
      }
    }
  }

  return {
    name: "Dead links",
    failed: broken.length > 0,
    lines: broken.map(({ file, candidate }) => `  ${file} -> ${candidate}`),
  };
}

function main() {
  const sections = [checkOwnershipSection(), checkTaskIndexFreshness(), checkDeadLinks()];

  let failed = false;
  for (const { name, failed: sectionFailed, lines } of sections) {
    if (lines.length === 0) {
      console.log(`${name}: clean`);
      continue;
    }
    console.log(`${name}:`);
    for (const line of lines) console.log(line.startsWith("  ") ? line : `  ${line}`);
    if (sectionFailed) failed = true;
  }

  const notice = promotionNotice();
  if (notice) console.log(`\n${notice}`);

  process.exitCode = failed ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
