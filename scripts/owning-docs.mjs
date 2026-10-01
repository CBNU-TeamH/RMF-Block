#!/usr/bin/env node
// For a PR: which owning design docs does it leave untouched? Prints a markdown
// comment body for the doc-reminders workflows. A reminder, not a gate — always
// exits 0 unless the script itself breaks.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { resolveMergeBase } from "./lib/merge-base.mjs";
import { loadClaims, ownersOf } from "./verify-doc-ownership.mjs";

export const MARKER = "<!-- owning-docs-reminder -->";

/** Map of owning doc -> changed files it owns, for docs not themselves changed. */
export function untouchedOwners(changedFiles, claims) {
  const changed = new Set(changedFiles);
  const result = new Map();
  for (const file of changedFiles) {
    for (const doc of ownersOf(file, claims)) {
      if (changed.has(doc)) continue;
      result.set(doc, [...(result.get(doc) ?? []), file]);
    }
  }
  return result;
}

export function renderComment(result) {
  if (result.size === 0) {
    return `${MARKER}\nNothing to remind: every owning doc for the changed files is also changed in this PR.\n`;
  }
  const lines = [...result].map(
    ([doc, files]) => `- \`${doc}\` owns ${files.map((f) => `\`${f}\``).join(", ")}`,
  );
  return `${MARKER}
This PR changes code whose owning design doc is untouched:

${lines.join("\n")}

A reminder, not a gate: update the doc, or say in the PR why it doesn't need to change.
`;
}

function arg(name) {
  const flag = process.argv.indexOf(name);
  return flag > 0 ? process.argv[flag + 1] : undefined;
}

// Deleted and renamed-from paths count too: removing owned code leaves its doc stale.
function changedAgainstMergeBase() {
  const base = resolveMergeBase();
  if (!base) throw new Error("no merge base found");
  return execFileSync("git", ["diff", "--name-only", "--no-renames", base, "HEAD"], { encoding: "utf8" });
}

function main() {
  const out = arg("--out");
  if (!out) throw new Error("usage: owning-docs.mjs --out <file> [--changed <file-list>]");
  // CI passes the PR's file list from the API (--changed); locally it diffs against main.
  const list = arg("--changed") ? readFileSync(arg("--changed"), "utf8") : changedAgainstMergeBase();
  const changed = list.split("\n").filter(Boolean);
  writeFileSync(out, renderComment(untouchedOwners(changed, loadClaims().claims)));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
