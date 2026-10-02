#!/usr/bin/env node
// Every SRS requirement ID cited outside the SRS must be defined in
// docs/SRS-ko.md (#130). A renumbered or retired ID otherwise lives on in code
// comments and docs, pointing at a requirement that no longer exists.
// Scans tracked files in app/ lib/ server/ scripts/ docs/ and the root docs +
// .github/, minus the SRS itself and docs/ui, docs/diagrams. Ranges
// (`FR-090-01..13`, `FR-010-01~04`) and shorthand (`FR-020-06/07`, `FR-060-01~03/05`) are
// expanded, each checked.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { definedIds } from "./verify-srs-sync.mjs";

const SRS = "docs/SRS-ko.md";
const SCOPE = /^(?:(?:app|lib|server|scripts|docs|\.github)\/|(?:ROADMAP|AGENTS|README)\.md$)/;
const SKIP = /^docs\/(?:SRS-[^/]*\.md|ui\/|diagrams\/)/;
const CITATION = /\b(?:UC-\d{3}|NFR-[A-Z]{3}-\d{3}|(?:SIR|SOIR|HIR)\d{3}|FR-\d{3}-\d{2}(?:(?:\.\.|~)\d{2})?(?:\/\d{2})*)/g;

// `FR-090-01..13` / `FR-010-01~04` -> each ID in the range; `/NN` adds one more (`FR-060-01~03/05`).
function expand(cite) {
  const fr = /^(FR-\d{3}-)(\d{2})(?:(?:\.\.|~)(\d{2}))?((?:\/\d{2})*)$/.exec(cite);
  if (!fr) return [cite];
  const [, prefix, first, last, more] = fr;
  const range = last ? Array.from({ length: Math.max(+last - +first + 1, 1) }, (_, i) => +first + i) : [+first];
  const nums = [...range, ...more.split("/").slice(1).map(Number)];
  return nums.map((n) => prefix + String(n).padStart(2, "0"));
}

function main() {
  const defined = definedIds(readFileSync(SRS, "utf8"));
  const files = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter((f) => SCOPE.test(f) && !SKIP.test(f));
  let count = 0;
  const problems = [];
  for (const file of files) {
    readFileSync(file, "utf8").split("\n").forEach((content, index) => {
      for (const [cite] of content.matchAll(CITATION)) {
        for (const id of expand(cite)) {
          count += 1;
          if (!defined.has(id)) problems.push(`${file}:${index + 1} — ${id} is not defined in ${SRS}`);
        }
      }
    });
  }
  if (problems.length === 0) {
    console.log(`SRS refs: clean — ${count} citations, all defined`);
    return;
  }
  console.log("SRS refs:");
  for (const problem of problems) console.log(`  ${problem}`);
  process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
