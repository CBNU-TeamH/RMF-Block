# Release build: fail fast on a QEMU hang, and pin binfmt

**Created**: 2026-10-28
**Issue**: #213
**Design**: none. ADR-009 owns the release workflow, and this change leaves its steps unchanged.

## Milestones

### 1. Timeout and pin

- **What**:
  - A hung release run fails after 30 minutes, not GitHub's 6-hour default.
  - The arm64 half builds under `tonistiigi/binfmt:qemu-v7.0.0`, which elsewhere measured free of the Node crash that hung v0.1.0's `pnpm install`.
- **Files**: `.github/workflows/release.yml`.
- **Reuse**: the workflow's re-run design. A timed-out run is retried by re-running it (`CONTRIBUTING.md`, "Releasing").
- **Done**: the `v0.2.0-rc.1` run finishes within the timeout, and its log shows the pinned binfmt image.

Not here: building arm64 on a native `ubuntu-24.04-arm` runner and merging the digests (#213 option 3, ADR-009 Consequences). It changes how the image is assembled. If the hang returns with the pin, it gets its own issue.

## Test selection

Use [the test-selection workflow](../../docs/testing.md#select-tests-for-each-change) before
building and revisit it for the final behavior. For each relevant layer, name existing tests
that cover it, required updates/new cases, or a concrete reason no change is needed.

- Vitest (logic / component / server / route): no change. No code changed.
- Browser E2E (`e2e/`): no change, for the same reason.
- Container smoke (`.github/workflows/ci.yml`): no change. `ci.yml` builds the image natively and does not use QEMU.
- Commands and observed results:
  - `pnpm verify:docs`: clean.
  - `release.yml` runs only on a `v*` tag, so the real check is the `v0.2.0-rc.1` tag after merge.

## Acceptance

- [x] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [x] `release.yml` sets `timeout-minutes: 30` on the release job and pins binfmt on `setup-qemu-action`.
- [ ] The `v0.2.0-rc.1` run succeeds within the timeout. This is checked after merge, under the v0.2.0 release.

## Cross-cutting

None. `CONTRIBUTING.md`'s "a failed run is retried by re-running it" already covers a timed-out run.

## Review

Shipped options 1 and 2 of #213. Option 3 was left for its own issue, to be opened only if the hang recurs.
