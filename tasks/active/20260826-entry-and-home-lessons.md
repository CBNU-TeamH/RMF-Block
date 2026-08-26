# Workspace entry and home — lessons

**Created**: 2026-08-26

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **`sessionByMemberId` is not "who is signed in".** It keeps the newest session id per member
  forever — nothing ever deletes from it — so `hasLiveSession()` built on it would have returned
  true for anyone who *ever* joined, and every returning guest would have been shown the takeover
  dialog. The map that actually answers the question is `memberBySession`, because that is the one a
  takeover deletes from. Four tests pin it.

- **A test that seals the wrong directory proves nothing.** The returning-member case sealed the
  store's *parent* after a first join had already created the store's own directory, so the second
  write succeeded and the test passed without ever reaching the failure path it was named for.
  Caught by asserting the file's bytes were unchanged, which is the assertion that should have been
  there from the start.
- **Two of the three mechanisms copied from `lib/chat/`, not three.** The task doc said to carry over
  the promise chain, the write-then-rename and the ENOENT-only-empty read. Making the member store
  synchronous deleted the first one's reason to exist: the queue serializes async appends that can
  interleave, and sync writes on one thread cannot. Sync also removed the async-singleton problem —
  the registry is constructed lazily behind a `globalThis` cache, and an async load would have made
  every caller await something that is read once. Marked with a `ponytail:` comment naming the
  ceiling and the way back.

## What we would do differently

- **`docker compose up -d --build` rebuilt the image and left the old container running.** Compose
  printed `app Built` then `Container rmf-app Running`, and the first round of verification hit the
  previous build — the 401 came back with its old English message and looked like the edit had not
  applied. `--force-recreate` is what actually swaps the container. Worth reaching for whenever a
  container is being re-tested rather than started fresh.

## Decisions the review forced

- **A failed `members.json` write is two different failures, not one.** A returning member is
  already on disk, so all it costs them is a fresher `lastJoinedAt` — the join goes through and the
  app degrades to exactly how it worked before members persisted, a state it has already run in. A
  first-time member was never durable, so the join is rolled back and refused. What makes that
  rollback safe is that a brand-new member cannot have displaced anyone: `revokedSessionId` is
  always null there, so there is no other device's session to put back. Leaving the mutations in
  place was the actual bug — `hasLiveSession()` reported the nickname as taken, the guest met a 409
  telling them to displace a device that did not exist, and the name stayed locked until restart.
- **`ownerId` became `createdBy`, because the SRS has no document ownership.** FR-022-06 and SIR003
  both say occupancy "does not block another user from editing", so everyone may edit everything;
  there is no per-document right for an owner to hold. What UC-021 does distinguish is the 생성자,
  whose screen the editor opens on. The column stays and the field stays — the name was the only
  thing claiming more than the system does.
- **Making the host the owner of everything was considered and dropped.** It buys nothing, since
  permissions are already shared, and it throws away the one fact the field records.
- **Soft delete belongs to FR-023, not here.** Nothing deletes documents yet, and the interesting
  half is not ours: content lives in Yorkie, so hiding a row while calling `remove()` on the Yorkie
  document would restore a name without its content. Issue #28 measured that a removed document's
  revisions stay reachable by id but drop out of `listRevisions`. Whoever builds deletion decides
  whether the Yorkie document is removed at all — soft delete falls out of that answer.
- **Runtime validation of the two JSON stores was declined.** The host is trusted not to hand-edit
  them. Worth knowing that this holds less for `documents.json` than for `members.json`: the
  fixtures in it are written by hand today, by design, and a wrapped array or a missing `updatedAt`
  across two or more records throws inside a server component and takes the home page with it.

## What the earlier write-ups no longer describe

[`docs/HOST-GUEST-ENTRY-ko.md`](../../docs/HOST-GUEST-ENTRY-ko.md) walks through the host/guest
entry flow as it was built, and two of its landmarks have moved since. It is **left as written** —
it is an account of that task, the way an archived task doc is, and rewriting it would turn a record
of how something was built into a claim about how it works now. What changed:

- **§3.5 `app/page.tsx` — 전부 여기로 수렴**, and the `app/page.tsx` node in the §2 diagram. That
  file is gone. Its auth gate and shell live in `app/(workspace)/layout.tsx`, and the screen itself
  in `app/(workspace)/page.tsx`; the URL is unchanged, because `(workspace)` is a route group.
- The screens it describes were English and rendered `hello host!` / `hello guest!`. The join form
  is Korean now, and `/` is the workspace home.

The flow it documents — a bootstrap secret printed to stdout, traded for a `role` cookie, with
everyone else sent to `/join` — is still exactly how entry works. Only the file layout moved.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- ...
