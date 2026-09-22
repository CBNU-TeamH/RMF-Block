# Upgrade Yorkie 0.7.13 → 0.7.23 — lessons

**Created**: 2026-09-22

## The measurement that started this

`20260922-version-history-lessons.md` recorded two `restoreRevision` defects and concluded
"reproduced identically on Yorkie 0.7.17, so upgrading the pin is not the fix". The conclusion was
drawn from two versions, 0.7.13 and 0.7.17, and **0.7.19 was never checked** — which is where
[yorkie#1967](https://github.com/yorkie-team/yorkie/pull/1967) fixed one of the two. The reproduction
was sound; the inference from it was not. Checking one newer version is not checking upstream.

## Re-measurement on 0.7.23 (throwaway projects, live server, 2026-09-22)

| # | What | 0.7.13 | 0.7.23 |
| --- | --- | --- | --- |
| ① | `type` key on an object inside an array, through `restoreRevision` | FAIL | **FAIL — unchanged** |
| ② | `)` inside a string silently becomes `}` | corrupted | **fixed** |
| ③ | SDK `YSON.parse` is string-aware | no — threw on an unbalanced `[` | **yes** |
| ④ | Event the restoring client receives | `snapshot`, 0 operations | **`remote-change`, 8 operations** |
| ⑤ | `doc.history.undo()` after a `restoreRevision` | stale reverse op | **throws `YorkieError: fail to find`** |
| ⑥ | ADR-007's two invariants | — | **both hold** |

① is verbatim: `{a:[{plain,type:'text'}]}` still fails `unsupported element`, and
`{a:[{plain,type:'Text'}]}` still fails `parse text: invalid YSON` — the same proof-of-mechanism
pair as before. ② was checked on all four strings that used to corrupt, including the exact one
from upstream's PR description; all four now round-trip.

**⑤ got worse, and that is the finding that matters.** On 0.7.13 the undo stack merely held a
reverse operation pointing at replaced content. On 0.7.23 `doc.history.undo()` **throws** after a
`restoreRevision` — it crashed the probe process outright. Controlled: the identical edit sequence
*without* the restore undoes cleanly on the same version, so the restore is the cause, not the
edits. A restore path built on `restoreRevision` would therefore have to reset the undo floor or
the next Ctrl+Z is an uncaught exception in the editor.

## What this does and does not change for #117

**Does not**: bug ① is the reason `restoreRevision` cannot see our documents at all, and it is
untouched. Using it would mean renaming `StoredBlock.type` → `kind` across every persisted
document — a migration, for a code path that then still needs ⑤ handled by hand. The app-side
restore (two ordinary `doc.update()` calls) keeps working, gets peer convergence and a safe undo
for free, and stays.

**Does**: ③ makes `lib/blocks/revision-snapshot.ts`'s hand-written string-aware scanner redundant.
Verified on a real snapshot of our own block shape — parens, an unbalanced `[`, a lone `]`,
embedded double quotes, CJK and an emoji all survive `yorkie.YSON.parse` intact. That is ~140 lines
to delete on the rebase. ④ means the restoring client would now recompute on its own, but the app
already does that explicitly and does not need it.

## What surprised us

- **An upstream fix can make a second thing worse.** ② got fixed and ⑤ regressed from "wrong
  content" to "thrown exception", in the same ten releases. Re-measuring only the thing you expect
  to have changed would have missed it — and it is the one that would have shipped a crash.
- **Ten releases, zero test changes.** All 571 tests passed unmodified, which says the tests do not
  reach the SDK behaviours that actually moved. ④ and ⑤ both changed and nothing went red. Issue
  #42's harness is the gap, and this upgrade is the second task to name it.
- **0.7.23 still declares neither `module` nor `exports`.** ADR-003 wrote that the patch "comes out
  as soon as upstream declares its own `exports`"; ten releases on, every bump just re-creates it
  under a new filename.

## What we would do differently

- Before concluding "upgrading is not the fix", read the changelog to the current release, not to
  the next version that happens to be installed. Two data points measured well still supported a
  wrong conclusion.
- Re-measure the *adjacent* properties, not just the defect under review. ⑤ was on the list only
  because the plan enumerated all six; a check scoped to "did ② get fixed" would have passed.

## Worth extracting

- A candidate for `docs/conventions.md`: **a measured claim carries the version it was measured
  against, and a version bump either re-measures it or says it did not.** `docs/design/api.md` now
  reads "measured against 0.7.13 and not re-measured on the current 0.7.23 pin" rather than having
  the number quietly updated underneath it — silently bumping the version in a sentence that says
  "measured" converts an unverified guess into a claim.
