#!/usr/bin/env node
// Keeps docs/SRS-en.md a structural mirror of docs/SRS-ko.md, the canonical
// text (#131). Translation accuracy is a review item; what this checks is what
// a translation can drift on without anyone reading it:
//   1. SRS-ko.md did not change without SRS-en.md against the merge base — an
//      English-only change is a translation fix and passes, since Korean is canonical;
//   2. the same requirement IDs are defined, in the same order;
//   3. the same heading levels, in the same order, with the same number of
//      table lines (`|`-leading) under each.
// Fails on any of them. CI runs it with --strict in the required
// `lint · test · build` job, which also fails when there is no merge base —
// otherwise check 1 would silently never run there.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolveMergeBase } from "./lib/merge-base.mjs";

const KO = "docs/SRS-ko.md";
const EN = "docs/SRS-en.md";

// Definitions only, never mentions: translation reorders the IDs a sentence
// cites, but not the headings and first cells that define them.
const ID_DEFINITION = [
  /^## (UC-\d{3})\b/,
  /^\| (FR-\d{3}-\d{2}|NFR-[A-Z]{3}-\d{3}) \|/,
  /^\| [^|]+ \| ((?:SIR|SOIR|HIR)\d{3}) \|/,
];

export function outline(text) {
  const ids = [];
  const sections = [{ level: 0, title: "(before the first heading)", line: 1, rows: 0 }];
  let fence = null;
  text.split("\n").forEach((content, index) => {
    const line = index + 1;
    // A `#` or `|` line inside a fence (mermaid, a shell example) is not structure.
    // CommonMark: a fence closes only on the same character, at least as long.
    const marker = /^(`{3,}|~{3,})/.exec(content)?.[1];
    if (marker && !fence) fence = marker;
    else if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = null;
    if (fence || marker) return;
    const heading = /^(#{1,6}) (.*)/.exec(content);
    if (heading) sections.push({ level: heading[1].length, title: heading[2], line, rows: 0 });
    else if (content.startsWith("|")) sections.at(-1).rows += 1;
    for (const pattern of ID_DEFINITION) {
      const match = pattern.exec(content);
      if (match) ids.push({ id: match[1], line });
    }
  });
  return { ids, sections };
}

export function compare(ko, en) {
  const a = outline(ko);
  const b = outline(en);
  const problems = [];

  const idCount = Math.max(a.ids.length, b.ids.length);
  for (let i = 0; i < idCount; i += 1) {
    if (a.ids[i]?.id === b.ids[i]?.id) continue;
    problems.push(
      `requirement ID #${i + 1} differs: ${KO}:${a.ids[i]?.line ?? "end"} has ${a.ids[i]?.id ?? "nothing"}, ` +
        `${EN}:${b.ids[i]?.line ?? "end"} has ${b.ids[i]?.id ?? "nothing"}`,
    );
    break;
  }

  const sectionCount = Math.max(a.sections.length, b.sections.length);
  for (let i = 0; i < sectionCount; i += 1) {
    const x = a.sections[i];
    const y = b.sections[i];
    if (x && y && x.level === y.level && x.rows === y.rows) continue;
    const describe = (s, file) => (s ? `${file}:${s.line} "${s.title}" (h${s.level}, ${s.rows} table lines)` : `${file}: no heading`);
    problems.push(`structure differs at heading #${i}: ${describe(x, KO)} vs ${describe(y, EN)}`);
    break;
  }

  return problems;
}

export function koChangedAlone(base) {
  const changed = execFileSync("git", ["diff", "--name-only", base, "--", KO, EN], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  return changed.includes(KO) && !changed.includes(EN);
}

function main() {
  const strict = process.argv.includes("--strict");
  const problems = compare(readFileSync(KO, "utf8"), readFileSync(EN, "utf8"));

  const base = resolveMergeBase();
  if (base === null) {
    if (strict) problems.push("no merge base found (upstream/main, origin/main, main) — cannot check what changed");
    else console.log("No merge base found — skipping the changed-together check.");
  } else if (koChangedAlone(base)) {
    problems.push(`${KO} changed without ${EN} — translate the change in the same PR`);
  }

  if (problems.length === 0) {
    console.log(`SRS sync: clean — ${EN} mirrors ${KO}.`);
    return;
  }
  console.log("SRS sync:");
  for (const problem of problems) console.log(`  ${problem}`);
  process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
