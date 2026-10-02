#!/usr/bin/env node
// Audit "parts" from the repo's `Owns:` lines: one part per design doc with claims, plus
// `_unowned` (code nobody claims) so a coordinator can see coverage. `--group <file.json>`
// merges parts by a {name: [doc paths]} mapping. Reuses the ownership checker's own parser,
// so the parts can never disagree with `pnpm verify:docs`.

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { checkOwnership, loadClaims } from "../../../../scripts/verify-doc-ownership.mjs";

// Part names are file-safe slugs so they work as `audit/<part>.json` names: the doc's basename,
// or its whole path with `/` → `-` when two docs share a basename (never merge two docs).
export function deriveParts(claims, unowned = []) {
  const docs = [...new Set(claims.map((c) => c.doc))];
  const dup = (doc) => docs.filter((d) => basename(d) === basename(doc)).length > 1;
  const slug = (doc) => (dup(doc) ? doc.replace(/\.md$/, "").replaceAll("/", "-") : basename(doc, ".md"));
  const parts = {};
  for (const { doc, claim } of claims) (parts[slug(doc)] ??= { docs: [doc], code: [] }).code.push(claim);
  return { ...parts, _unowned: unowned };
}

export function groupParts(parts, mapping) {
  const codeOf = new Map(Object.entries(parts).filter(([k]) => k !== "_unowned").map(([, p]) => [p.docs[0], p.code]));
  const out = { _unowned: parts._unowned };
  for (const [name, docs] of Object.entries(mapping)) out[name] = { docs, code: docs.flatMap((d) => codeOf.get(d) ?? []) };
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values: o } = parseArgs({ options: { group: { type: "string" } } });
  const parts = deriveParts(loadClaims().claims, checkOwnership().unowned);
  const mapping = o.group ? JSON.parse(readFileSync(o.group, "utf8")) : null;
  console.log(JSON.stringify(mapping ? groupParts(parts, mapping) : parts, null, 2));
}
