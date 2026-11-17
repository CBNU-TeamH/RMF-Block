# Perf harness: don't race the follower's release at share end

**Created**: 2026-11-18
**Issue**: none yet. The two voided rounds (`judge4` 13 and 15) are listed as unregistered in the D07 draft's §7.6. Open one if the team wants it tracked.
**Design**: none, this is a harness-only change. The app behaviour it relies on is in [Presence and focus](../../docs/design/presence-and-focus.md) (FR-030-11: a share that ends releases its followers).

## What went wrong

`present()` in `e2e/perf/round.perf.ts` ends with:

```ts
const following = follow.page.getByRole("button", { name: /따라가는 중/ });
if (await following.isVisible()) await following.click();
```

When the lead clicks `공유 종료`, the app releases the follower on its own: `focus-follow-provider.tsx` clears `current` the moment the roster says the presenter is no longer presenting, so the `…님을 따라가는 중 · 종료` button disappears by itself. The roster update reaches the follower after the H↔G latency (p95 ~200 ms). `isVisible()` is a snapshot: it can return `true`, the release arrives, and `click()` then waits for a button that never comes back. The configured `actionTimeout` is 60 s, so the round stalls for a minute and is recorded as `aborted` ("element was detached from the DOM, retrying"). It happened in 2 of 20 `judge4` rounds (13, 15) and in 0 of 4 `judge4-b` rounds; there are two `present()` calls per round.

## Plan and trade-offs

Keep the harness's current behaviour (unfollow if it still can) and remove the unbounded wait:

```ts
const following = follow.page.getByRole("button", { name: /따라가는 중/ });
await following.click({ timeout: 2_000 }).catch(() => undefined); // released already? fine
await expect(following).toBeHidden();                              // 15 s, the suite's expect timeout
```

| Option | Verdict |
| --- | --- |
| **A. Bounded click, then assert hidden** (above) | Chosen. Same follower path as today when the click wins. When the release wins, the click times out harmlessly. A follower still following 15 s after the share ended fails the round, which is a real FR-030-11 signal and was a (slower) failure before too. |
| B. Drop the click, only wait for hidden | Simpler, but every round would take the natural-release path, which shows the "share ended" notice (`setShareEnded` in the provider) instead of the silent `unfollow`. That changes what the browsers do during the measured window and is not covered by a measured baseline. |
| C. `.catch(() => {})` around the whole thing | Hides a follower that is never released. Rejected. |

Not in scope: the other 60 s `actionTimeout` exposure in the harness, the observation stack, any app code.

## Milestones

### 1. Make the share-end cleanup race-free

- **What**: the follower's cleanup after `공유 종료` no longer stalls on a button that vanished.
- **Files**: `e2e/perf/round.perf.ts` (the last lines of `present()`).
- **Reuse**: the existing `following` locator and Playwright's `expect(...).toBeHidden()`. Nothing new.
- **Done**: 40 single-machine share/end cycles show the old code's timeout and the new code's zero (or, if the old code does not reproduce in 40, that is recorded as is), and a one-machine perf round passes both `present()` calls.

## Test selection

Use [the test-selection workflow](../../docs/testing.md#select-tests-for-each-change) before
building and revisit it for the final behavior.

- Vitest (logic / component / server / route): no change. `present()` needs two live browsers; the harness's own Vitest tests cover `stats.mts`, the join attempt and the port check, none of which this touches.
- Browser E2E (`e2e/`): no change. The app is untouched, and `e2e/follow.e2e.ts` already covers a share ending while someone follows.
- Container smoke (`.github/workflows/ci.yml`): no change, the harness is not in CI (`docs/testing.md`, performance harness).
- By hand on the rig (the harness's only check, per `docs/testing.md`): a throwaway script (not committed) that starts and ends a share 40 times on a single machine against the container, once with the old two lines and once with the new ones, counting click timeouts. Localhost propagation is a few ms, so the release is far more likely to beat the click than over Wi-Fi. Then `PERF_SINGLE_MACHINE=1 PERF_USERS=2 PERF_MINUTES=1 pnpm perf` for a full round.
- Commands and observed results (fill in before the PR):

## Acceptance

- [ ] `present()` cannot wait on a detached element for longer than the 2 s click limit.
- [ ] A follower that is still following 15 s after the share ended fails the round instead of being swallowed.
- [ ] Old vs new over 40 single-machine cycles recorded (old: timeouts, new: none), or an honest note if the old code did not reproduce.
- [ ] A one-machine 2-user 1-minute round passes through both `present()` calls.
- [ ] `pnpm lint` and `pnpm typecheck` pass; required test changes are included, and gaps are recorded above.

## Cross-cutting

- NFR-PER-001 (the judgment cell counts any aborted round as failed): this removes one harness-side cause of aborts. It does not change any recorded result: `judge4` 13 and 15 stay voided on the operator's judgement, documented in `judge4/operator-notes.md`.
- No SRS or design doc changes. The D07 draft (untracked, outside the repo) gets its §7.6/7.7 rows updated after this merges.

## Review

Filled in at the end: what shipped, what was cut, what moved to another task.
