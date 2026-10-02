// Optional index for doc-drift auditors (SKILL.md step 3): parses a TS/Next repo with the
// TypeScript compiler API and writes structural facts — routes and their methods, client
// fetch/WebSocket calls matched to routes, socket paths, SDK call sites, env vars.
// A map of where to look, never evidence on its own. The SDK patterns (`yorkie`) are this
// repo's; adapt them for another stack.
//
//   node extract-facts.mjs --out <dir> [--parts <parts.json>]   (run from the repo root)
//   parts.json: derive-parts.mjs output, or { "<part>": ["<code glob>", ...] } — writes facts-<part>.json slices too.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { extractFacts, sliceFacts } from '../../../../scripts/lib/ast-facts.mjs';
const { values: opt } = parseArgs({ options: { out: { type: 'string' }, parts: { type: 'string' } } });
const OUT = path.resolve(opt.out ?? 'facts');
fs.mkdirSync(OUT, { recursive: true });

const { files, ...facts } = extractFacts();
const { routes, clientCalls, wsPaths, yorkie, envVars, matching } = facts;
fs.writeFileSync(path.join(OUT, 'facts.json'), JSON.stringify(facts, null, 1));

const slices = sliceFacts({ ...facts, files }, opt.parts ? JSON.parse(fs.readFileSync(opt.parts, 'utf8')) : {});
const counts = {};
for (const [part, slice] of Object.entries(slices)) {
  fs.writeFileSync(path.join(OUT, `facts-${path.basename(part, '.md')}.json`), JSON.stringify(slice, null, 1));
  counts[part] = Object.fromEntries(Object.entries(slice).map(([k, v]) => [k, Array.isArray(v) ? v.length : typeof v === 'object' ? Object.keys(v).length : v]));
}
const matchingCalls = matching.calls;
console.log(JSON.stringify({
  routes: `${routes.length}/${files.filter((f) => /^app\/api\/.*\/route\.ts$/.test(f)).length}`, clientCalls: clientCalls.length, wsPaths: wsPaths.length, sdkCalls: yorkie.length, envVars: envVars.length,
  unresolved: clientCalls.filter((c) => c.unresolved).map((c) => c.at),
  noRoute: matchingCalls.filter((m) => !m.unresolved && !m.route && m.kind !== 'ws').map((m) => `${m.method} ${m.path} @ ${m.at}`),
  methodMismatch: matchingCalls.filter((m) => m.methodOk === false).map((m) => `${m.method} ${m.path} @ ${m.at}`),
  noCaller: matching.routesWithNoClientCaller.map((r) => r.path),
  slices: counts,
}, null, 1));
