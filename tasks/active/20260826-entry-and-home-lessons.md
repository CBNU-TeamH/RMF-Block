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

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- ...
