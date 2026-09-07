#!/usr/bin/env node
// Every doc section a code comment names, checked against the docs.
//
// `verify-docs.mjs` catches a dead *path*; this catches a live path pointing at
// a section that does not exist — which is what a comment does when the doc it
// cites gets rewritten around it. The two failures look identical to a reader
// ("go read that") and only one is findable by opening the file.
//
// This is what lets a comment be short. `conventions.md` kind 4 says rationale
// moves to `docs/design/` and the code keeps a pointer; a pointer nobody
// verifies is how the rationale gets lost anyway, one rename at a time.
//
// Always exits 0 unless a reference is broken. Reports the file, the doc and
// the section, so the fix is either the comment or the heading.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execSync("git ls-files '*.ts' '*.tsx' '*.mts'", { encoding: "utf8" })
  .trim().split("\n").filter((f) => !f.includes(".test."));

// Headings and bold sentences both: a comment points at either.
const anchors = new Map();
for (const doc of execSync("git ls-files 'docs/*.md' 'docs/**/*.md' 'AGENTS.md'", { encoding: "utf8" })
  .trim().split("\n").filter(Boolean)) {
  const text = readFileSync(doc, "utf8");
  const heads = text.split("\n").filter((l) => /^#{1,6} /.test(l)).map((l) => l.replace(/^#+\s*/, ""));
  const bold = [...text.matchAll(/\*\*([^*\n]{4,90})\*\*/g)].map((m) => m[1]);
  anchors.set(doc, [...heads, ...bold]);
}
const norm = (x) => x.replace(/[`*"“”]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

// Joined per contiguous comment block. Joining a whole file invents
// references that are not there -- measured, three false positives.
function commentBlocks(src) {
  const out = []; let buf = [];
  for (const line of src.split("\n")) {
    if (/^\s*(\*|\/\*|\/\/)/.test(line)) buf.push(line.replace(/^\s*(\/\*+|\*\/|\*|\/\/)\s?/, ""));
    else { if (buf.length) out.push(buf.join(" ")); buf = []; }
  }
  if (buf.length) out.push(buf.join(" "));
  return out;
}

const QUOTED = /`?((?:docs\/)?[a-zA-Z0-9/_.-]+\.md)`?[^"“]{0,30}?["“]([^"“”]{4,90})["”]/g;
let checked = 0; const bad = [];
for (const f of files) {
  for (const block of commentBlocks(readFileSync(f, "utf8"))) {
    for (const m of block.matchAll(QUOTED)) {
      const [, ref, section] = m;
      checked++;
      const doc = anchors.has(ref) ? ref
        : [...anchors.keys()].find((k) => k.endsWith("/" + ref));
      const list = doc && anchors.get(doc);
      if (!list) { bad.push([f, ref, section, "no such doc"]); continue; }
      if (!list.some((h) => norm(h).includes(norm(section)) || norm(section).includes(norm(h))))
        bad.push([f, doc, section, "no such section in it"]);
    }
  }
}
console.log(`Doc references from code: ${checked} checked, ${bad.length} broken`);
for (const [f, doc, s, why] of bad) console.log(`  ${why}\n    ${f}\n    -> ${doc} "${s}"`);

process.exitCode = bad.length ? 1 : 0;
