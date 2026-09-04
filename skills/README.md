# Skills

What to install before working in this repository, and when to reach for each one.

Two rules govern everything below, and both predate this file's current shape:

**Pointer files, not vendored copies.** Each entry names an external skill or plugin and
where to get it, so using it means fetching the current version instead of a snapshot pasted
in once that drifts from the source. That applies to a plugin's own command files too — if
one needs different settings, write the setting down here as a rule rather than forking the
file into this repository.

**None of these fire automatically.** Suggest the relevant one at the point in the task where
it fits, and let the person decide — don't run one unprompted, and don't assume it is installed.

---

## Required

Install these before contributing. Without them, **how thoroughly a change gets checked
depends on who wrote it**, and `main` cannot tell the difference between a branch that went
through review and one that did not.

```bash
# `claude-plugins-official` is a default marketplace. If it is not registered:
#   /plugin marketplace add anthropics/claude-plugins-official
/plugin install code-review@claude-plugins-official
/plugin install code-simplifier@claude-plugins-official
/plugin install claude-md-management@claude-plugins-official
```

| Plugin | Why this repository needs it | When to invoke |
| --- | --- | --- |
| **`code-review`** | Launches **five parallel review agents** (see the model note below — they inherit your session's model), and **two of them read our rules** — one checks CLAUDE.md compliance, one checks code-comment compliance. The other three cover obvious bugs, git blame, and previous PRs. Findings are scored 0–100 and anything under 80 is dropped. [`docs/conventions.md`](../docs/conventions.md) (#69) is the rubric those two agents apply — that is what turns a written rule into a check that runs. Before it existed they had no project rulebook to check against, which is the gap Phase 1 closed. | Before opening a PR, **from a Sonnet session**: `/code-review low` |
| **`code-simplifier`** | *"Simplifies and refines code for clarity, consistency, and maintainability **while preserving functionality**."* Those last three words are the failure mode tests cannot see — code that behaves correctly and is shaped wrongly. #40 is the worked example. | While working, **from a Sonnet session**: `/simplify` |
| **`claude-md-management`** | Two halves. `claude-md-improver` audits the harness against the actual state of the codebase, which is how we catch `AGENTS.md` routing to files that do not exist. `/revise-claude-md` captures what a session learned, which is the execution step our lessons → harness promotion loop has always been missing. | Starting work: audit. Finishing a task: `/revise-claude-md` as the promotion step |

### Depth: run `code-review` at `low`

CodeRabbit already runs a wide pass on every PR — five of our open issues were found that
way. Running full depth locally buys the same breadth a second time.

**What we buy locally is the timing, not the depth**: catching something *before* the PR is
opened, while it is still that PR's concern. A finding raised after the fact becomes "handle
separately", and separately-handled work loses the priority contest — all five of those
CodeRabbit findings are still open.

`low` is documented as *"fewer, high-confidence findings"*, which is exactly that role.

Anything the review surfaces below the confidence cutoff, or outside the PR's scope, **goes
to an issue rather than being quietly dropped**. Coverage comes from the pipeline as a whole,
not from any single command.

### Run the free checks first

`pnpm verify:fast` — lint plus the test suite — costs **zero tokens**. Anything it can catch, it
should catch: a review that spends a findings slot on a lint-level nit is paying model tokens for
something a script already knows, and costs the reader attention on top.

So the order is: **`pnpm verify:fast` clean, `pnpm comments` / `pnpm verify:docs` showing nothing
new → then `/simplify` → then `/code-review low`**.

"Nothing new" rather than "clean" for the second pair, because `verify:docs` exits non-zero on a
dead link and **seven of those are a known baseline** — one illustrative import specifier quoted
verbatim from real source in `docs/conventions.md`, and six past-tense mentions of since-removed
files in `docs/HOST-GUEST-ENTRY-ko.md`. Both were examined and deliberately left (#71); the check
is useful as a diff against that baseline, not as a gate that can ever read green.

#65 widened that first step, and both halves of it shipped in #71: `pnpm comments` (the comment
budget) and `pnpm verify:docs` (doc ownership, task-index freshness, dead links), plus a
pre-commit hook that runs the staged-file part on every commit. The archive-pending list that
#65 originally sketched for `verify:docs` is not among them — it was not built.

This matters more than it sounds. Our PRs run to a median of 494 changed lines across 12
files, with the larger ones (#51, #53, #60) between 2,000 and 2,800 lines — for a repository
whose entire source is under 4,400 lines. Five agents each reading a diff that size is
effectively several passes over the codebase, and `low` reduces the number of *findings*, not
the amount read.


### Model: switch to Sonnet before running either command

**Both `/code-review` and `/simplify` must be run from a Sonnet session.**

```bash
/model claude-sonnet-5     # then run /code-review low, or /simplify
```

The plugin's `commands/code-review.md` names Sonnet for its five reviewers and Haiku for the
filtering passes — **but that instruction does not survive.** Measured 2026-09-03: the
sub-agents inherit the model of the session that launched them, so running `/code-review`
from an Opus session gets five parallel **Opus** reviewers. That is the most expensive way to
buy a pass we deliberately scoped down to `low` for cost reasons in the first place, and it
quietly undoes the reasoning above.

There is no settings key for a default sub-agent model, so the session model is the only
lever. Switching for the duration of the review is the whole workaround. Authoring can go
back to whatever model you prefer afterwards — it is the *fan-out* that is expensive, not the
session.

The same applies to `/simplify`: it is a sub-agent doing a mechanical comparison against a
rule list, which is Sonnet-shaped work.

### Settled by reading the plugins, so nobody has to re-check

- **The confidence cutoff is 80**, set in step 6 of that same file. Editing it means editing
  the plugin's file, which the pointer rule forbids — so treat 80 as fixed and use issues for
  what falls below it.
- **`/revise-claude-md` does not follow our `@AGENTS.md` import.** It locates files literally,
  with `find . -name "CLAUDE.md" -o -name ".claude.local.md"`. Our `CLAUDE.md` is a one-line
  pointer, so left alone the command would write session learnings *into that pointer*.
  **Tell it the target is `AGENTS.md` when you run it, and never let it edit `CLAUDE.md`.**
  Inverting the two files would fix it mechanically but break the reason `AGENTS.md` exists —
  it is the tool-neutral entry point, and `CLAUDE.md` is only the Claude-specific shim.

---

## Optional

| Skill | What it is for | When to invoke |
| --- | --- | --- |
| [`explain-diff.md`](explain-diff.md) | Walks a diff or PR file by file, to close a knowledge gap before reviewing something you did not write. | Suggest it when someone asks for a diff or PR to be explained, or says they don't follow a change. |

---

## Deferred, with the trigger written down

| Skill | Status |
| --- | --- |
| `webapp-testing` ([anthropics/skills](https://github.com/anthropics/skills)) | Playwright-based browser verification. The only thing that can reach #52 (needs a real browser and a Korean IME) and the gaps that leaf server-component tests leave open. Held back for cost — a third runner, browser binaries, and a Python runtime in a pnpm/Node repo — not for doubt. Tracked with its trigger in **#61**. |
| `hookify` | Builds Claude Code hooks, which act on agent behaviour during a session — a different layer from the git hooks `.githooks/` will add at commit time. Tempting for enforcing things like "write the task doc first", but automating a rule before it has settled in writing is the wrong order. **Trigger**: `docs/conventions.md` in daily use. |
| `security-guidance` | **Trigger**: #19 (OPAQUE over plaintext HTTP) or #27 (join rate limiting) being picked up. Those issues carry the trigger themselves; no separate one is needed. |

---

## Do not add these

Both look like obvious additions to the list above, and are not.

| | Why not |
| --- | --- |
| `feature-dev` | Its agents for exploration, architecture and quality review overlap our SDD workflow (`tasks/` todo + lessons) head-on, and two procedures for one job means neither is followed. Duplication rather than bad timing, so a rejection rather than a deferral. |
| `ponytail` | Said of itself *"not installed by default — it's a per-person plugin choice"*, which a repository convention cannot rest on; `code-simplifier` fills the slot officially. The `ponytail:` markers still in the source are separate — #65 renames them to `simple:`, and **this row can go with them.** |
