---
name: doc-drift-audit
description: Audits a repository's design docs against its code — claims the code contradicts, facts duplicated across docs, stale history narration — then has a human approve fixes on a GitHub checklist, applies them in isolated worktrees and closes the audit issue. Use when a drift-audit issue is open, after several tasks have been archived, or when asked whether the docs still match the code, to find doc drift, or to dedupe or slim down design docs.
---

# Doc drift audit

A procedure, not a tool. It needs `git`, `gh` and `node`, nothing specific to one agent. Steps that say **fan out** run one sub-agent per part in parallel if your tool has sub-agents; otherwise run the same parts one after another in a single session — the instructions and outputs are identical.

The coordinator (you) plans, verifies, decides and integrates. Sub-agents find and edit. Never delegate a judgement call (what to fix, which doc owns a fact).

Run every command **from the repo root**; `$SKILL` is this skill's directory — `.claude/skills/doc-drift-audit` (canonical) or its copy `.agents/skills/doc-drift-audit`; both work. `<scratch>` is any working directory outside the repo (a session scratchpad, `/tmp/…`); keep all audit files there, not in the repo.

**Single-session mode** (no sub-agents): run each fan-out step part by part yourself, still writing every result to its file and keeping only counts in mind before moving on. Do the A/F verification (step 5) as a separate pass that re-reads the files from disk and doubts the findings — ideally in a fresh session, since the same context that wrote a finding is the worst judge of it.

## Progress
Copy this into your notes and tick as you go:
```
- [ ] 0 base commit + issue(s) to close
- [ ] 1 baseline posted on the issue
- [ ] 2 parts.json
- [ ] 3 facts (optional)
- [ ] 4 audit JSON per part
- [ ] 5 verify-AF.json
- [ ] 6 checklist posted, human approval read back
- [ ] 7 edits committed per group, handoffs collected
- [ ] 8 integrated, verified, after-numbers, audit task archived, PR open
```

Two rules for every step:
- **Precision over recall.** A false finding costs a human's attention; a missed one costs nothing until the next audit. An auditor that finds nothing has done a good run.
- **A step that didn't run is not a clean step.** If a check, review or verifier couldn't run, say so — never report it as passed.

## 0. Before you start
- There is an issue to close: the open `drift-audit` issue. If that issue's body names another issue as the audit's definition (here it names this skill; older ones named #129), close that too; otherwise there is just the one.
- Find the issue: `gh issue list --label drift-audit --state open` — call its number `$ISSUE`.
- Record the base commit on an up-to-date main: `git fetch && git switch -c docs/drift-audit origin/main && BASE=$(git rev-parse HEAD)`. Every measurement, sub-agent prompt and worktree uses it.
- Register the task the repo's way (here: copy `tasks/templates/todo.md` and `tasks/templates/lessons.md` to `tasks/active/YYYYMMDD-drift-audit-{todo,lessons}.md`, then `pnpm tasks:index`).
- Name the audit's task doc slug exactly `YYYYMMDD-drift-audit` (in this repo, `scripts/post-merge-reminders.mjs` treats that slug as "an audit happened" and resets its count from its archive date).
- Every prompt you give a sub-agent starts with: *check `git log --oneline -1` is `<sha>`; stop and report if not.* Worktrees and checkouts drift; this check is what stops an agent from working on a stale base.

## 1. Baseline
Run the repo's deterministic doc checks first (here: `pnpm verify:docs` — links, ownership, requirements sync); whatever they catch costs no model tokens and needs no auditor. Then measure before touching anything, and post it on the audit issue — the PR's result section compares against it.

```sh
node $SKILL/scripts/derive-parts.mjs > <scratch>/parts.json      # step 2; edit or --group it first if needed
node $SKILL/scripts/baseline.mjs --parts <scratch>/parts.json --ref $BASE > <scratch>/baseline.md
gh issue comment $ISSUE --body-file <scratch>/baseline.md
```
`baseline.mjs` prints bytes/lines per part, an 8-word-shingle duplicate count per doc pair, and history-marker counts (the patterns live in the script).

## 2. Parts
Group each doc with the code it describes, so each auditor reads one doc set and one code area.
- If design docs declare `- **Owns**:` lines (this repo does — see `scripts/verify-doc-ownership.mjs`), `derive-parts.mjs` derives one part per design doc (output shape in its header), plus `_unowned`: code no doc claims — add each path to the `code` list of the part whose topic it belongs to. Every script here accepts that file as-is.
- Group related docs into one part with `--group <map.json>`, e.g. `{ "realtime": ["docs/design/architecture.md", "docs/design/presence-and-focus.md"] }`. Add ADRs and root docs (AGENTS.md, README) to the part whose topic they cover — they declare no ownership.
- Otherwise write `parts.json` by hand in the same shape, or as `{ "<part>": ["<doc>", …] }` (docs only).
- If the budget is tight, audit first the parts whose code changed most since the last audit (`git log --since=<last audit> --stat -- <code paths>`).
- Aim for 5–8 parts. Split a doc over ~600 lines at a section boundary between two auditors (give each a line range); fold a doc under ~150 lines into a neighbour.
- Leave out generated renders, mockups, and agreed requirements docs (those get category E only).

## 3. Structural facts — optional
For a TypeScript/Next codebase, `node $SKILL/scripts/extract-facts.mjs --out <scratch>/facts --parts <scratch>/parts.json` writes structural facts per part (what it extracts: the script header).

It is an **index** for auditors — where to look, and the cross-boundary edges a directory scope misses (client call → route → socket hub). Auditors still open the files to decide. Skip it for other stacks; the audit works without it. (Deterministic checks of declared facts — "never called", "only called from `app/**`", a constant's value — belong in CI, not here: grep cannot tell a call from a comment, the AST can.)

## 4. Audit — fan out, read-only
One auditor per part, each given `references/audit-instructions.md`, its doc set, its code scope and (optionally) its facts slice. Each writes `<scratch>/audit/<part>.json` and returns only counts and its top three findings — the detail stays in files, so the coordinator's context stays small.

Categories: **A** doc contradicts code · **B** behaviour the owning doc misses · **C** a fact duplicated across docs · **D** history narration in a design doc · **E** requirements-doc drift (report only) · **F** code looks wrong.

## 5. Verify A and F — one more agent
Auditors read stale content and overstate fixes. Give one agent `references/verify-instructions.md` (part 1) and every A/F finding; it writes `<scratch>/verify-AF.json` (keep it outside `audit/`, which holds findings only); the rules, the score scale and when to split across verifiers are in the reference. Use the corrected fix for `partial`, drop `false`.

## 6. Triage and approval
- **A, F** — the coordinator decides. An F that turns out to be a stale *comment* is fixed in the PR, not filed.
- **E** — one issue for the team; never edit an agreed requirements doc.
- **B, C, D** — one checklist comment on the audit issue, for a human to tick:
  ```sh
  node $SKILL/scripts/render-checklist.mjs <scratch>/audit --verify <scratch>/verify-AF.json > <scratch>/checklist.md
  gh issue comment $ISSUE --body-file <scratch>/checklist.md   # prints the comment URL; its #issuecomment-<id> is the id below
  ```
  Items are grouped by the file they edit, so overlapping findings from different auditors sit together. Unticked means not applied. Ask the person who asked for the audit (or the repo's maintainer) to tick the items, and **wait for them to say they're done** — don't infer approval from silence. If they answer in chat instead, tick for them and record their decisions at the top of the comment. Then read them back:
  ```sh
  gh api repos/{owner}/{repo}/issues/comments/<id> -q .body | node $SKILL/scripts/read-approvals.mjs -
  ```
- Defaults that held on the first run: don't edit ADRs (they keep history — shrink only the design doc's copy to a link); keep measurement figures; leave requirements docs alone.

## 7. Apply — fan out in worktrees
- Build one package per edit group: the approved items (A/F plus ticked B/C/D) for a **disjoint set of files**. No two editors touch the same file.
- Create the worktrees yourself, **outside the repo directory** (inside it, `eslint .` scans them), all from the same commit:
  `git worktree add ../<repo>-wt-<group> -b wt/<group> <sha>`
- Each editor gets `references/apply-instructions.md` and its package, commits **one commit per category**, and reports edits needed in files outside its set as **handoffs**.
- Worktrees have no `node_modules`, so a pre-commit hook that runs a linter fails there. Doc commits usually pass; anything that needs the hooks is handed back for the coordinator to commit in the main checkout. Never `--no-verify`.

## 8. Integrate, measure, open the PR
- One commit per category across groups: `git cherry-pick -n <A commits of every group>`, then `git commit`; repeat for B, C, D, F. Hooks run once per category. With disjoint files there are no conflicts; if one appears, the file sets weren't disjoint — `git cherry-pick --abort`, apply that group's change to the shared file as a handoff instead.
- Apply handoffs as **their own commit after the category commits** — a fixup into an earlier category conflicts with later edits to the same file. One agent may make the edits in the main checkout without committing; you review and commit. Post issue-side handoffs (open questions moved to their issue) yourself.
- Run the repo's doc checks (here: `pnpm verify:docs`), then a **review loop of at most 3 rounds** with `references/verify-instructions.md` (part 2), one fresh verifier per round, each with a different lens:
  1. nothing lost — moved facts exist at their new owner, sources link to them, **anchors resolve** (a file-existence link checker misses `#anchor`s);
  2. the edits are true — A/B edits checked against the code;
  3. the rest of the diff — workflow, scripts, wording that changed meaning.

  Give each round: `$BASE`, the diff (`git diff $BASE`), its lens, and `rebuttals.md` if one exists. In single-session mode, run each round as a fresh pass that re-reads the files from disk with only that lens in mind. Stop at the first round with no blocking finding. Fix blocking findings as fixups before the next round. A finding you think is wrong goes into `<scratch>/rebuttals.md` as `- <id>: <why it is wrong, with file:line>` and is handed to the next verifier, who either accepts the rebuttal or re-raises it with evidence. Three rounds with blocking findings still open means stop and ask the human on `$ISSUE` — don't loop further.
- `node $SKILL/scripts/baseline.mjs --parts <scratch>/parts.json --ref HEAD` again for the after-numbers — **on the final commit**, after every fixup (a later one-line fix moved the first run's numbers).
- **Archive the audit task inside the audit PR** as the last commit. If it is archived later, merging closes the audit issue while the count is still high, and the next post-merge run opens a new one.
- PR body: `Closes` the defining issue **and** the open `drift-audit` issue; the before/after table; what was not applied and why.

## First run (RMF-Block #129, 2026-10-02)
136 findings (A 49 · B 11 · C 38 · D 36 · E 0 · F 2) → A/F verified 41 / 7 / 3 → 70 B/C/D approved → 118 applied. Audited docs −13.4% bytes, −14.9% lines; ADR-copy overlap 222 → 0 and 126 → 41. Merge closed both issues and the count reset to 0.

## Lessons
- An auditor's "verified" is not verified — budget one checking agent, and one more after integration.
- A reviewer's "not checked" is not "no findings".
- An approximation named in a comment still needs checking against real data.
- Automation that closes things on a condition must close only what it opened (filter by author or marker).
- Split edit work by file and conflicts disappear; whatever crosses files comes back as a handoff.
