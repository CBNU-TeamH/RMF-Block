#!/usr/bin/env node
// Reads the **Owns** line at the top of every docs/design/*.md file and checks
// it against what's actually on disk under lib/ and app/. Three verdicts:
//
//   unowned   — a lib/ module or app/ file no doc claims (a coverage hole)
//   dead      — a doc claims a path that doesn't exist (a dead reference)
//   duplicate — two docs claim the same path at the same specificity
//
// A doc's Owns entry can be a directory (trailing slash — everything under it)
// or a single file. When two docs' claims overlap, the more specific one wins
// silently rather than counting as a duplicate — see docs/design/document-editing.md's
// Owns line for the case this exists for (its `app/(workspace)/documents/`
// directory claim yields to presence-and-focus.md's file-level claim on one
// file inside it). Only an exact tie at the same specificity is a real duplicate.
//
// lib/ is checked at module (top-level subdirectory) granularity — each
// lib/<name>/ is one unit, since that's how the modules are actually organized.
// app/ is checked at file granularity, since app/(workspace)/ in particular
// mixes unrelated components as siblings with no shared rationale. server/ and
// scripts/ are out of scope: see each design doc's own Owns line for why —
// architecture.md explicitly owns nothing, and no doc claims server/*.mts.
//
// Plain Node, no dependencies. Exit 1 on a genuine authoring defect — a dead
// reference, a duplicate claim, or a doc missing its Owns line entirely.
// Coverage holes are reported but do not fail the run: a hole is honest,
// expected state (this repo has eleven right now — app/join/*, the API routes
// with no design doc, and a few shell files) and forcing it to zero here would
// be scope creep past what track C's own task asks for. Matches the
// "routing signal, not a gate" shape comment-budget.mjs already uses.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([a-zA-Z]):/, "$1:");

function listDesignDocs() {
  const dir = join(ROOT, "docs", "design");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(dir, f));
}

// Parses the `- **Owns**: a, b, c.` entry. Backtick-quoted paths only — matches
// how every design doc already writes them. Reads the *whole* entry, not just
// its first line: a long Owns list wraps across several lines indented to
// align under the bullet (chat.md's does), and a single-line regex silently
// drops everything past the first `\n` — caught by running this against the
// real docs, not by reading the regex. The entry ends at the first blank line
// or the next top-level `- **` bullet. A line saying "none" (architecture.md)
// yields an empty claim list, which is not an error.
function parseOwns(docPath) {
  const lines = readFileSync(docPath, "utf8").split("\n");
  const startIdx = lines.findIndex((l) => /^-\s*\*\*Owns\*\*:/.test(l));
  if (startIdx === -1) return null; // no Owns line at all — reported separately, not a hole/dead-ref source

  const entryLines = [lines[startIdx].replace(/^-\s*\*\*Owns\*\*:\s*/, "")];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "" || /^-\s*\*\*/.test(line)) break;
    entryLines.push(line);
  }
  const paths = [...entryLines.join(" ").matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  // Only lib/ and app/ paths count as claims — those are the only two roots this
  // checker tracks. Without this, a backtick-quoted path in the entry's own
  // explanatory prose (a cross-reference to another doc, a mention of this
  // script's own path) gets parsed as a real claim. architecture.md's "none"
  // line is exactly that trap: it explains the claim is empty by naming `lib/`
  // and `app/` in passing, and a looser filter took those as two claims that,
  // being bare directory prefixes, silently absorbed ownership of everything —
  // caught only by running this against the real docs, not by reading the regex.
  return paths.filter((p) => p.startsWith("lib/") || p.startsWith("app/"));
}

function listLibModules() {
  const dir = join(ROOT, "lib");
  return readdirSync(dir)
    .filter((f) => statSync(join(dir, f)).isDirectory())
    .map((f) => `lib/${f}/`);
}

function listAppFiles() {
  const dir = join(ROOT, "app");
  const out = [];
  function walk(d) {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
        out.push(relative(ROOT, full).replaceAll("\\", "/"));
      }
    }
  }
  walk(dir);
  return out;
}

// True if `claim` (a directory with trailing slash, or an exact file) covers `path`.
function covers(claim, path) {
  return claim.endsWith("/") ? path.startsWith(claim) : path === claim;
}

function specificity(claim) {
  return claim.endsWith("/") ? claim.length : claim.length + 1000; // exact file always beats a directory
}

export function checkOwnership() {
  const docs = listDesignDocs();
  const claims = []; // { doc, path, claim }
  const deadReferences = [];
  const missingOwnsLine = [];

  for (const doc of docs) {
    const owns = parseOwns(doc);
    const label = relative(ROOT, doc).replaceAll("\\", "/");
    if (owns === null) {
      missingOwnsLine.push(label);
      continue;
    }
    for (const claim of owns) {
      const onDisk = claim.endsWith("/")
        ? existsSync(join(ROOT, claim))
        : existsSync(join(ROOT, claim));
      if (!onDisk) {
        deadReferences.push({ doc: label, claim });
        continue;
      }
      claims.push({ doc: label, claim });
    }
  }

  const units = [...listLibModules(), ...listAppFiles()];
  const unowned = [];
  const duplicates = [];

  for (const unit of units) {
    const matches = claims.filter((c) => covers(c.claim, unit));
    if (matches.length === 0) {
      unowned.push(unit);
      continue;
    }
    const bestSpecificity = Math.max(...matches.map((m) => specificity(m.claim)));
    const winners = matches.filter((m) => specificity(m.claim) === bestSpecificity);
    const distinctDocs = new Set(winners.map((w) => w.doc));
    if (distinctDocs.size > 1) {
      duplicates.push({ unit, docs: [...distinctDocs] });
    }
  }

  return { unowned, deadReferences, duplicates, missingOwnsLine };
}

function main() {
  const { unowned, deadReferences, duplicates, missingOwnsLine } = checkOwnership();

  if (missingOwnsLine.length > 0) {
    console.log(`No **Owns** line found (add one, even "none" — see architecture.md):`);
    for (const doc of missingOwnsLine) console.log(`  ${doc}`);
    console.log();
  }

  if (deadReferences.length > 0) {
    console.log(`Dead references — claimed but not on disk:`);
    for (const { doc, claim } of deadReferences) console.log(`  ${doc} → ${claim}`);
    console.log();
  }

  if (duplicates.length > 0) {
    console.log(`Duplicates — claimed by more than one doc at the same specificity:`);
    for (const { unit, docs } of duplicates) console.log(`  ${unit} ← ${docs.join(", ")}`);
    console.log();
  }

  if (unowned.length > 0) {
    console.log(`Coverage holes — no doc claims these:`);
    for (const u of unowned) console.log(`  ${u}`);
    console.log();
  }

  const failed =
    deadReferences.length > 0 || duplicates.length > 0 || missingOwnsLine.length > 0;
  if (!failed && unowned.length === 0) {
    console.log("Ownership check clean: every lib/ module and app/ file is claimed exactly once.");
  } else if (!failed) {
    console.log(`${unowned.length} coverage hole(s) noted above — not blocking.`);
  }
  process.exitCode = failed ? 1 : 0;
}

// pathToFileURL, not a hand-built `file://` string: on Windows a correct file
// URL has a third slash before the drive letter (`file:///C:/...`), which a
// manual `file://${path}` concatenation omits. That mismatch made this guard
// silently never fire — caught by running the script and getting no output
// at all with exit 0, not by reading the comparison.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
