#!/usr/bin/env node
// Reads a ticked-up checklist (render-checklist output, as edited on GitHub) and prints
// which item ids were approved, left unticked, and any "↳ note" typed under an item.
// Usage: read-approvals.mjs <file|->   e.g. gh api .../comments/ID -q .body | read-approvals.mjs -

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function readApprovals(body) {
  const out = { approved: [], unticked: [], notes: {} };
  let id;
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^\s*- \[([ xX])\] \*\*([^*]+)\*\*/);
    if (m) {
      id = m[2];
      (m[1] === " " ? out.unticked : out.approved).push(id);
    } else if (id && /^\s+↳ /.test(line)) out.notes[id] = line.replace(/^\s+↳ /, "").trim();
    else id = undefined;
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const src = process.argv[2];
  console.log(JSON.stringify(readApprovals(readFileSync(src === "-" ? 0 : src, "utf8")), null, 2));
}
