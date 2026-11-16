# Serialize the Yorkie sync loop's per-document pushes

**Created**: 2026-11-16
**Issue**: #257
**Design**: none to extend; the SDK patch is the mechanism (`package.json` `patchedDependencies`, [ADR-003](../../../../docs/adr/003-stack-choices.md) §3). The two-documents-per-client layout is in [`docs/design/presence-and-focus.md`](../../../../docs/design/presence-and-focus.md) and [`docs/design/document-editing.md`](../../../../docs/design/document-editing.md).

One browser holds one Yorkie client with the `workspace` document and the open document attached. The SDK's sync loop
(`runSyncLoop`, `@yorkie-js/sdk` 0.7.23) pushes every attached document at once with `Promise.all`. When both have a change in
the same tick, the server answers one of them `400 change clientSeq must increase by one`, and the loop then stops for good
(`handleConnectError` is false for `invalid_argument`): the user's later edits never leave the page. Evidence and a
reproduction are in the issue; in CI it fails the first collaboration spec about half the time. The cause is inferred from the SDK and
the traces, not from Yorkie's server code: the reproduction (a 400 in every run with one client, none with two) is the evidence.

## Milestones

### 1. Sync one attached document at a time

- **What**: the sync loop awaits each document's `syncInternal` before starting the next, so one client never has two
  `PushPullChanges` in flight. Same for `Client.sync()` when called without a document.
- **Files**: `patches/@yorkie-js__sdk@0.7.23.patch` (regenerated with `pnpm patch` / `pnpm patch-commit`; both `dist/yorkie-js-sdk.es.js`
  and `dist/yorkie-js-sdk.js`, the two builds the package exports).
- **Reuse**: the existing patch of the SDK's `package.json`; no app code moves. Keep the loop's `setSyncPromise`/`clearSyncPromise` and the per-attachment
  AuthError / epoch-mismatch `.catch`; the change is one `await` per attachment. A rejection no longer stops the tick: the loop tries every
  document, then rethrows the first error, as `Promise.all` effectively did. `Client.sync()` still resolves to the results.
- **Done**: the reproduction (two documents on one client plus a peer, 600 rounds) shows no 400 in 12 runs; unpatched it showed one every run.

### 2. A guard that fails when the patch is lost

- **What**: case ⑥ in `scripts/verify-yorkie-invariants.mjs`: one client, two documents updated back to back so both have a change at every
  tick. It counts the `PushPullChanges` requests in flight (the SDK calls the global `fetch`) and expects never more than one, then
  checks a fresh reader sees both documents' last edit. The count is the guard: whether Yorkie refuses the second push is a race
  (the reader check alone passed on an unpatched SDK in half the runs), so the case asserts what the client sends. It resolves the
  package's `import` condition, so it guards the ES build only; the UMD patch is not guarded.
- **Files**: `scripts/verify-yorkie-invariants.mjs` (the case and a comment on why it exists; the header lists no cases).
- **Reuse**: the script's reporter, `client()` and `settle()`; CI already runs it against a bare Yorkie.
- **Done**: green with the patch, red on the SDK without it, on a Compose stack (see Test selection).

### 3. Say why the patch exists

- **What**: ADR-003 says the patch is only an `exports` workaround that goes away when upstream declares one; after this it also serializes the sync loop, so that is no longer true.
- **Files**: `docs/adr/003-stack-choices.md`: decision 1 (the patch paragraph), the sentence about `patchedDependencies` "for both Yorkie packages" (only the SDK is patched), and the "pinned to a patched SDK" consequence; the matching comment in `next.config.ts`.
- **Done**: a reader of ADR-003 learns the patch has a second job that outlives the `exports` fix, and that the invariants case is what tells an upgrade lost it.

## Not in this task

- `detachDocument` with `keepalive` (pagehide) skips the SDK's task queue and could still overlap a loop push of another document. Nothing in `app/` or `lib/` uses `keepalive`, so it stays a known gap.
- Recovery when a sync loop stops for another reason (#37). This removes the cause of one such stop, not the silence.
- Splitting the workspace document onto its own client (option B in the issue): rejected, it leaves two block documents open together exposed.

## Test selection

Use [the test-selection workflow](../../../../docs/testing.md#select-tests-for-each-change) before
building and revisit it for the final behavior.

- Vitest (logic / component / server / route): no change; the patched code is vendored SDK, not ours.
- Browser E2E (`e2e/`): no new spec. `collaboration.e2e.ts` "edits go both ways" is the symptom; the repeat run is in Acceptance (before: 1 failure locally, 3 of 6 CI runs).
- Container smoke (`.github/workflows/ci.yml`): the invariants step gains the case from milestone 2; its E2E step is the CI evidence.
- Commands and observed results:
  - Reproduction (one client, two documents, a peer, 600 rounds, isolated Compose stack): shipped patch 2 of 3 runs hit a 400 and one reader stopped at 532 of 600; this patch 0 of 12, every reader at 600.
  - Case ⑥ against that stack, 2 runs each of the final version: shipped patch red 2 of 2 (2 pushes in flight; the reader check red in 1 of 2); this patch green 2 of 2. The first version (4 runs each) was red 4 of 4 and green 4 of 4.
  - After CodeRabbit's review (the loop tries every document and rethrows the first error; `Client.sync()` returns its results; case ⑥ stops earlier clients first): reproduction 0 of 6 runs with a 400, every reader at 600 (shipped patch: a 400 and a reader at 529); case ⑥ shipped patch red 2 of 2, this patch green 2 of 2. The 40-run browser repeat below predates that change; CI's E2E step covers it.
  - `collaboration.e2e.ts` `--repeat-each=40` on an isolated stack built from this branch: 200 passed, 0 failed (27 min).

## Acceptance

- [x] The milestone 1 reproduction: the reader converges every run.
- [x] `collaboration.e2e.ts` `--repeat-each=40` on an isolated stack: 0 failures.
- [ ] The PR's CI E2E step passes on three pushes or reruns. Not met as written: merged on the team's decision after one inspected PR run (smoke test green) and the run on main (44 E2E passed, `collaboration.e2e.ts` included).
- [x] The invariants case passes with the patch and fails without it.
- [x] Required test changes are included with the implementation; relevant checks and any gaps are recorded (case ⑥; the UMD hunk is unguarded).
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm verify:docs` and the comment budget pass (the pre-push hook and CI on #261, then CI on main).

## Cross-cutting

SRS: NFR-SAF-001 (changes survive), FR-022-09 (concurrent edits converge). No API, type or storage change.

## Review

Merged as #261 (`5dc70d7`). The loop awaits each document's sync in both builds, tries every document and rethrows the first error, and `Client.sync()` still returns its results; case ⑥ of the invariants script counts `PushPullChanges` in flight. Measured on isolated stacks: the reproduction went from a 400 in 2 of 3 runs to 0 of 12 (0 of 6 after the review fixes), `collaboration.e2e.ts` ran 200 times without a failure, and main's E2E passed 44. Known gap: `detachDocument` with `keepalive` skips the SDK's task queue. #37 (recovery after a loop stops for another reason) is untouched.
