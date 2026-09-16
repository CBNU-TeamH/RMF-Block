# Tool alignment — skills/ as an install manifest — lessons

**Created**: 2026-09-03

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **A plugin's README disagreed with its own command file, and we had built on the README.**
  `plugins/code-review/README.md` summarises the tool as *"four specialized reviewers"* with
  *"2 agents: check compliance against CLAUDE.md"*. `commands/code-review.md` — the file that
  actually runs — says **five parallel Sonnet agents**: CLAUDE.md compliance, obvious bugs,
  git blame, previous PRs, and **code-comment compliance**. The harness review and the Phase
  0/1/2 issues were all written from the README and had to be corrected.

  The correction made the argument stronger, not weaker. There is a review lens dedicated to
  comments, so `docs/conventions.md`'s comment rules (#65 C1) do not merely inform a general
  reviewer — they become one agent's entire rubric.

- **One deferred question was answerable by reading; the other needed running, and reading
  would have given the wrong answer.** `/revise-claude-md`'s import behaviour was sitting in a
  public `commands/*.md` file — ten minutes of fetching replaced a blocked milestone. The
  review model was not: `commands/code-review.md` names Sonnet for its five reviewers, and we
  wrote that into the manifest as settled. **It is not what happens.** Sub-agents inherit the
  model of the session that launched them, so an Opus session gets five parallel Opus
  reviewers no matter what the command file says.

  The cost of getting this wrong is invisible: the review still runs and still produces
  findings, so nothing looks broken — you simply pay several times over for a pass we had
  deliberately scoped down to `low` on cost grounds. There is no settings key for a default
  sub-agent model, so switching the session model is the only lever, and the manifest now says
  so for both `/code-review` and `/simplify`.

- **`/revise-claude-md` would have written into the wrong file.** It locates targets with
  `find . -name "CLAUDE.md" -o -name ".claude.local.md"` — literal names, no import
  resolution. Our `CLAUDE.md` is one line (`@AGENTS.md`), so the promotion tool we adopted to
  fix F-2 would have appended session learnings to a pointer file. Caught before first use
  only because the task asked the question.

## What we would do differently

- **Write the acceptance criterion after the milestone, not alongside it.** Milestone 2 says
  "delete the pointer and record why in the manifest"; the acceptance said `grep -rn ponytail
  skills/` must be empty. Those cannot both hold. The test was written from the shape of the
  action rather than from the result we wanted.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- **Read a plugin's `commands/` and `skills/` files, not its README, before depending on its
  behaviour — and then run it once before writing the behaviour down as settled.** The README
  lagged the implementation by a whole review lens and one agent. The command file, in turn,
  described an intent (Sonnet) that the runtime overrides (session model). Three sources, three
  different answers, in increasing order of authority: README < command file < what it does.
  Same habit as `AGENTS.md` §0's instruction to read `node_modules/next/dist/docs/` rather than
  trusting recall about Next — extended one step, because docs can be right about intent and
  still wrong about behaviour.

- ~~**Any sub-agent fan-out inherits the session model...**~~ / ~~**Order the checks by what
  they cost, not by what they cover.**~~ — **promoted 2026-09-16** to `AGENTS.md` §6.

- ~~**A tool that edits "the project's memory file" needs checking against our two-file
  split.**~~ — **promoted 2026-09-16** to `AGENTS.md`'s header.

- **This task doc pair was created as the first file-writing action** — an item that has been
  sitting in this section since 2026-08-12 (`20260812-chat-service-lessons.md`: *"create the
  `tasks/active/` todo+lessons pair as the first file-writing action … worth a line in
  `AGENTS.md` §2's workflow table if this recurs"*). It has now recurred. #65 promotes it.
  Note for whoever does that: the promotion loop's first pass has a queue of 26 items, not one.
