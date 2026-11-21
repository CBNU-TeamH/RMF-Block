# Upgrade Yorkie and the JS SDK 0.7.23 → 0.7.28 — lessons

**Created**: 2026-11-17

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **"Upstream added `exports`, so the patch goes" was half right.** The patch had grown a second job the day before
  (#261, the sync loop for #257), and the first read of it — on a branch that predated #261 — showed only the
  `exports` hunk. Read the patch on the base you are branching from, not the one checked out.
- **A server fix can remove the cause while the client still shows the symptom's shape.** 0.7.28's SDK still syncs
  documents with `Promise.all`, but the 400 it triggered looks like a server cache race fixed in yorkie#2112. Whether
  the client workaround is still needed is a measurement, not a reading.
- **A guard can silently change what it guards.** Case ⑥ "guards the ES build" only because the old patch made Node's
  `import` resolve to `es.js`; upstream's map sends Node to the CJS build instead, and the comment became false
  without any code in this repo changing.

## What we would do differently

- **Keep a reproduction script in the repo, not only described in an issue.** #257's was "kept outside the repo", so
  this bump had to rebuild it from prose and then prove the rebuild reproduces (a throwaway 0.7.23 stack) before a
  green result on 0.7.28 meant anything.
- **A version bump re-checks every dated measurement, not only the ones the plan lists.** `version-history.md`'s
  "a revision outlives its document by id" (0.7.13) turned out false on 0.7.28, and UC-023's 비고 rests on it.

## Build notes

- **Never edit a file under `node_modules/.pnpm` in place to test a revert.** pnpm hard-links it to the global store,
  so an in-place write changes every project using that version. Move the file aside, copy it back, edit the copy,
  then move the original back — a new inode, nothing shared touched.
- The browser build loads in Node by path (`createRequire(import.meta.url).resolve` → its directory → `es.mjs`) and
  brings its own `Client`/`Document` classes, so case ⑥ runs once per build without either seeing the other.

## Worth extracting

- A green "the bug no longer reproduces" needs a control run that does reproduce it with the same script.
