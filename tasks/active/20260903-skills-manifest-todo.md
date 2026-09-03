# Tool alignment — skills/ as an install manifest

**Created**: 2026-09-03
**Issue**: #64 (Phase 0 of #67)
**Design**: no doc in `docs/design/`. This changes how the team installs its tooling, not
how the product works — the reasoning lives in the harness review linked from #67, and the
result *is* `skills/README.md` itself.

## Milestones

### 1. Rewrite `skills/README.md` as an install manifest

- **What**: the file names the plugins this repository expects, how to install them, why
  each one is needed *here*, and when to invoke it. Today it lists three pointers and
  mentions neither of the two tools we actually use.
- **Files**: `skills/README.md`.
- **Reuse**: the two conventions already at the top of that file — pointer files rather than
  vendored copies, and never run one unprompted. Both are still right and stay verbatim.
  The table format is already there too; it gains two columns rather than being replaced.
- **Done**: someone who has never opened this repository can install the same toolchain from
  that file alone, and every entry says *when* it is called, not only what it is.

### 2. Retire `skills/ponytail.md`

- **What**: delete the pointer, and record in the manifest why it is not used.
- **Files**: `skills/ponytail.md` (deleted), `skills/README.md`.
- **Reuse**: nothing. `code-simplifier` fills the same slot as an official plugin, which is
  the reason the pointer goes.
- **Done**: `skills/ponytail.md` is gone and nothing links to it. The name still appears in
  the manifest's "considered and not used" table, which is where a rejection belongs.

  The nine `ponytail:` markers in `app/`, `lib/` and `server/` are **not** part of this task —
  they are #65's C7, and #37 still references one. Deleting the pointer without renaming the
  markers leaves them pointing at nothing for the length of Phase 1; that is accepted, because
  renaming them here would put a source-wide `sed` inside a docs-only PR.

### 3. Answer the two open questions in the manifest

- **What**: two things were expected to need the plugins installed.
  1. Does `claude-md-management` follow our `CLAUDE.md`, which is the single line `@AGENTS.md`?
  2. Is the review model configurable in the plugin's `commands/code-review.md`? Its README
     documents the confidence threshold as editable there; the model is not mentioned.
- **Files**: `skills/README.md`.
- **Reuse**: nothing.
- **Done**: both answers are written down, with the source, so nobody re-checks them.

  **Both were settled by reading the plugins' own command files — no install needed.**

  1. **No.** `commands/revise-claude-md.md` locates files literally with
     `find . -name "CLAUDE.md" -o -name ".claude.local.md"` and does not resolve imports.
     Left alone it would write session learnings into our one-line pointer. The manifest
     records the rule: name `AGENTS.md` as the target when running it.
  2. **No — and reading was not enough here.** `commands/code-review.md` *names* Sonnet for the
     five reviewers and Haiku for the filtering passes, with the cutoff at 80 in step 6. But
     running it showed the sub-agents **inherit the session's model**, so an Opus session gets
     five Opus reviewers regardless of what that file says. There is no settings key for a
     default sub-agent model, so the manifest carries the only lever there is: switch the
     session to Sonnet before running `/code-review` or `/simplify`.

## Acceptance

- [x] `skills/README.md` lists `code-review`, `code-simplifier` and `claude-md-management`
      with install command, reason, and invocation point.
- [x] The manifest states that `/code-review` runs at `low` depth, and why: CodeRabbit already
      runs a wide pass on every PR, so what we buy locally is the timing, not the depth.
- [x] `skills/explain-diff.md` is unchanged.
- [x] `skills/ponytail.md` no longer exists and nothing links to it. The *name* stays, in the
      manifest's "considered and not used" table — recording why a tool was rejected is the
      point of that table, so "no occurrences of the string" was the wrong test to write.
- [x] Both open questions are answered in the file, with their source, not left open.
- [x] `bash scripts/tasks-index.sh` is idempotent — re-running it changes nothing.

## Cross-cutting

- **#65 (Phase 1) depends on this.** Its C1 writes `docs/conventions.md`, which only becomes
  a review rubric because two of `code-review`'s five agents read our rules — one on CLAUDE.md
  compliance, one on code-comment compliance. Installing the plugin is what turns that document
  into a check, and the comment lens means C1's comment rules get applied the same way.
- **#37** references the `ponytail:` marker convention. It stays accurate until #65 renames
  the markers; leave a note there when that happens, not now.
- No SRS requirement covers tooling, so nothing in `docs/SRS-ko.md` changes.
- `AGENTS.md` §4 already routes to `skills/` — the row stays correct and needs no edit here.

## Review

Shipped all three milestones. Two things came out differently than planned.

**One question was answered by reading, one needed running.** Milestone 3 assumed both needed
the plugins installed. The import question was answered from a public `commands/*.md` file in
minutes. The model question was *not*: the command file names Sonnet, and that turned out to
describe intent rather than behaviour — the sub-agents take the session's model. Only running
it revealed that. Reading the command file rather than the README still corrected a separate
detail this task was built on — see lessons.

**One acceptance criterion was self-contradictory** and got rewritten mid-task: milestone 2
asks for the rejection to be recorded in the manifest, while acceptance demanded the string
`ponytail` appear nowhere under `skills/`. The file is gone; the name stays in the
"considered and not used" table, which is what that table is for.

Nothing was cut. The nine `ponytail:` markers in source stay for #65 as planned — they point
at a retired pointer for the length of Phase 1, which is accepted and written down above.
