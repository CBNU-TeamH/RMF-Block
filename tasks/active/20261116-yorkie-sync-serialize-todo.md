# Serialize the Yorkie sync loop's per-document pushes

**Created**: 2026-11-16
**Issue**: #257
**Design**: none to extend; the SDK patch is the mechanism (`package.json` `patchedDependencies`, [ADR-003](../../docs/adr/003-stack-choices.md) §3). The two-documents-per-client layout is in [`docs/design/presence-and-focus.md`](../../docs/design/presence-and-focus.md) and [`docs/design/document-editing.md`](../../docs/design/document-editing.md).

One browser holds one Yorkie client with the `workspace` document and the open document attached. The SDK's sync loop
(`runSyncLoop`, `@yorkie-js/sdk` 0.7.23) pushes every attached document at once with `Promise.all`. When both have a change in
the same tick, the server answers one of them `400 change clientSeq must increase by one`, and the loop then stops for good
(`handleConnectError` is false for `invalid_argument`): the user's later edits never leave the page. Evidence and a
reproduction are in the issue; in CI it fails the first collaboration spec about half the time.

## Milestones

### 1. Sync one attached document at a time

- **What**: the sync loop awaits each document's `syncInternal` before starting the next, so one client never has two
  `PushPullChanges` in flight. Same for `Client.sync()` when called without a document.
- **Files**: `patches/@yorkie-js__sdk@0.7.23.patch` (regenerated with `pnpm patch` / `pnpm patch-commit`; both `dist/yorkie-js-sdk.es.js`
  and `dist/yorkie-js-sdk.js`, the two builds the package exports).
- **Reuse**: the existing patch of the SDK's `package.json`; nothing else changes. No app code moves.
- **Done**: the reproduction (two documents on one client plus a peer, 600 rounds) shows no 400 in 12 runs, where unpatched it showed one in every run.

### 2. A guard that fails when the patch is lost

- **What**: a case in `scripts/verify-yorkie-invariants.mjs`: one client, two documents, both updated every few milliseconds with a peer
  doing the same, then a fresh reader sees the last edit. It fails on an SDK that sends the two pushes concurrently, which is what
  an upgrade that drops the patch would do.
- **Files**: `scripts/verify-yorkie-invariants.mjs`; `docs/testing.md` or the script's own header, wherever the cases are listed.
- **Reuse**: the script's reporter and its admin helpers; CI already runs it against a bare Yorkie.
- **Done**: green with the patch; red on an unpatched `node_modules` (checked once by hand and recorded below).

### 3. Say why the patch exists

- **What**: one paragraph where the patch is described, so the next SDK upgrade re-applies it deliberately.
- **Files**: `docs/adr/003-stack-choices.md` (the patchedDependencies note), and a comment in the invariants case.
- **Done**: a reader of ADR-003 learns the patch also serializes the sync loop and what to do on an upgrade.

## Not in this task

- Recovery when a sync loop stops for another reason (#37). This removes the cause of one such stop, not the silence.
- Reading Yorkie's server code. The cause is established from the symptom and the controlled comparison, not from the server.
- Splitting the workspace document onto its own client (option B in the issue): rejected, it leaves two block documents open together exposed.

## Test selection

Use [the test-selection workflow](../../docs/testing.md#select-tests-for-each-change) before
building and revisit it for the final behavior.

- Vitest (logic / component / server / route): no change; the patched code is vendored SDK, not ours.
- Browser E2E (`e2e/`): no new spec. `collaboration.e2e.ts` "edits go both ways" is the symptom: `--repeat-each=40` on an isolated stack before (1 failure locally, 3 of 6 CI runs) and after.
- Container smoke (`.github/workflows/ci.yml`): the invariants step gains the case from milestone 2; its E2E step is the CI evidence.
- Commands and observed results (fill in before the PR):

## Acceptance

- [ ] The reproduction: 12 runs with the patch, no `clientSeq` failure and the reader converges every time.
- [ ] `collaboration.e2e.ts` `--repeat-each=40` on an isolated stack: 0 failures; and the PR's CI E2E step passes on three pushes or reruns.
- [ ] The invariants case passes with the patch and fails without it.
- [ ] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm verify:docs` and the comment budget pass.

## Cross-cutting

SRS: NFR-SAF-001 (changes survive), FR-022-09 (concurrent edits converge). A patch to a vendored dependency: re-check on every `@yorkie-js/sdk` bump.
No API, type or storage change. Closes #257.

## Review

Filled in at the end.
