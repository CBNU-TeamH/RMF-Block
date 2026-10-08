# The app-side `.data/` layer — lessons

**Created**: 2026-10-08

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- The issue asked for "workspace metadata storage", which #170 had already shipped. Only
  `architecture.md` still said "still to come". Check an issue's listed scope against `main`
  before planning, not just against the issue text.
- Going sync deleted both write queues with no test changes. The existing concurrency tests
  ("concurrent append() … don't lose", "does not lose an upload to a concurrent one") were
  written against the race, not the queue, so they kept guarding it.
- A TTL test built from `Date.now()` around two real deletes failed: they landed in the same
  millisecond, so "just inside the TTL" was not. Fixed `deletedAt` values written to
  `deleted.json` make the edge exact.

## What we would do differently

- Recording `documentId` on document uploads from the start (FR-022-13/14) would have
  let delete, restore and purge reach every file. Files uploaded before this task have no
  owner, so they stay visible after their document is deleted.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- A new store under `.data/` goes through `lib/json-file.ts`, sync. An `await` inside its
  read-modify-write needs a queue back (`chat.md`, "Storage") — candidate for `docs/conventions.md`.
- Render dates, not "n days left": a server-rendered client component that reads the clock
  can mismatch on hydration. Pin `timeZone: "Asia/Seoul"` as the chat components do.
