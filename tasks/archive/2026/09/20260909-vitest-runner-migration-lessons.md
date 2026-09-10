# Vitest runner migration (Phase 2, track C4) — lessons

**Created**: 2026-09-09

## What surprised us

- jsdom 30.0.1 does not implement `HTMLDialogElement.prototype.showModal()` — the smoke test
  (`dialog.showModal()`) threw `TypeError: dialog.showModal is not a function`. happy-dom 20.14.0
  passed the same test unchanged. Swapped: removed `jsdom`, kept `happy-dom` as the DOM
  environment for files that opt in via `// @vitest-environment happy-dom`.
- pnpm's local Node floor was stale (24.1.0) relative to jsdom's `engines.node` requirement
  (`^24.15.0`) — silently ignored because `engine-strict` is off. Moot once jsdom was dropped for
  happy-dom, but the local Node was bumped to latest LTS (24.21.0) anyway since CI/Docker already
  float to latest 24.x. See ADR-004.
- `@types/node` was pinned at 20.19.43, below vitest 5's peer range (`^22 || >=24`); bumped to
  `^24` to match the Node floor and clear the peer warning.

## What we would do differently

- An Explore-agent fact check ahead of the file migration miscounted the `*.test.mts` total as 30
  in its summary while its own enumerated list had 31 entries — caught by re-running `find`
  directly before trusting the number. Recount a subagent's stated total against its own
  enumerated list rather than the summary line when the two could disagree.
- All 31 files, 456 tests pass unchanged under Vitest. Local WSL timings over the `/mnt/c` mount
  (test ~10s, build ~66s) are not representative of CI or a native filesystem — recorded that
  caveat directly in `.githooks/pre-push`'s header rather than citing a number that would mislead
  the next person running it on a faster machine.

## Worth extracting

- The jsdom-vs-happy-dom outcome and the rationale for going with a full runner migration instead
  of ADR-003 §4's originally-sketched "addition, not migration" — promoted to
  `docs/adr/004-test-runner-migration.md` directly rather than waiting for archive time, since it's
  exactly the kind of decision an ADR (not a lessons file) should hold.
