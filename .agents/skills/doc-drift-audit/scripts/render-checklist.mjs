#!/usr/bin/env node
// Merges per-part audit JSONs (and optional verification verdicts) into one approval
// checklist: A/F findings collapsed (already verified), D/C/B as tickable items grouped
// by target file. Usage: render-checklist.mjs <audit-dir> [--verify <verify-AF.json>]

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const target = (doc) => doc.split(/[:\s,]/)[0];
const byTarget = (a, b) => target(a.doc).localeCompare(target(b.doc)) || a.id.localeCompare(b.id, undefined, { numeric: true });

export function loadFindings(dir) {
  return readdirSync(dir).filter((f) => f.endsWith(".json")).flatMap((f) => {
    const j = JSON.parse(readFileSync(join(dir, f), "utf8"));
    return Array.isArray(j.findings) ? j.findings : [];
  });
}

const item = (f) =>
  `- [ ] **${f.id}** \`${f.doc}\` — ${f.fix}${f.cat === "C" && f.owner ? ` → owner: \`${f.owner}\`` : ""}${f.saves_lines ? ` (−${f.saves_lines} lines)` : ""}${f.confidence ? ` _[${f.confidence}]_` : ""}`;

export function render(findings, verdicts = {}) {
  const cat = (c) => findings.filter((f) => f.cat === c).sort(byTarget);
  const kept = (c) => cat(c).map((f) => {
    const v = verdicts[f.id];
    if (v?.verdict === "false") return `- ~~**${f.id}** \`${f.doc}\` — ${f.fix}~~ dropped: ${v.note}`;
    if (v?.verdict === "partial") return `- **${f.id}** \`${f.doc}\` — ${v.note} (partial: corrected fix)`;
    return `- **${f.id}** \`${f.doc}\` — ${f.fix}`;
  });
  const af = [...kept("A"), ...kept("F")];
  const out = [`<details><summary>Verified A/F findings (${af.length})</summary>`, "", ...af, "", "</details>"];
  for (const c of ["D", "C", "B"]) {
    const fs = cat(c);
    out.push("", `## ${c} — ${fs.length} items, −${fs.reduce((s, f) => s + (f.saves_lines || 0), 0)} lines`);
    let last;
    for (const f of fs) {
      if (target(f.doc) !== last) out.push("", `**${(last = target(f.doc))}**`, "");
      out.push(item(f));
    }
  }
  return out.join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values: o, positionals: [dir] } = parseArgs({ options: { verify: { type: "string" } }, allowPositionals: true });
  const results = o.verify ? JSON.parse(readFileSync(o.verify, "utf8")).results : [];
  console.log(render(loadFindings(dir), Object.fromEntries(results.map((r) => [r.id, r]))));
}
