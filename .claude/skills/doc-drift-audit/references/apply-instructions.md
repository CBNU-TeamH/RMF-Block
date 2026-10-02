# Apply instructions (give to each editor)

You apply approved doc fixes in **your own git worktree** (path and expected HEAD in your prompt). `cd` into it for every command; never touch the main checkout or another worktree. Check `git log --oneline -1` first; stop if it differs.

Your package lists `files` (the only paths you may edit) and `items` (id, cat, doc, claim, evidence, fix). A `fix` starting with "CORRECTED FIX" or containing "DECISION:" overrides the rest of the item.

## Rules
1. **Re-read the current file before each edit**; find the passage by content, not line number. If an item no longer applies, skip it and say so.
2. **Edit only paths in your `files` list.** If an item also needs an edit elsewhere, do your side and report the other side as a **handoff**.
3. **Never edit ADRs or agreed requirements docs.** Where an item mentions an ADR, do only the design-doc side.
4. By category:
   - **A** — make the doc match the code; verify against the code yourself first.
   - **B** — add the missing behaviour in 1–3 sentences, in the doc's own style.
   - **C** — keep the fact in the owner doc; replace the copy with a one-line summary and a relative link.
   - **D** — delete, or rewrite as present-tense truth; keep the *why*; keep measurement figures when a DECISION says so.
   - **F** — fix the stale code comment only; no behaviour change.
5. Keep each doc's voice; don't reflow untouched paragraphs; keep ownership lines valid and every relative link resolvable — including `#anchors` (an anchor must match a real heading).
6. Moving a doc out of `docs/` (only if an item says so): `git mv` it to the repo's archive location, fix every link to it in your files, report links elsewhere as handoffs.
7. Commit **one commit per category present**, in the order A, B, C, D, F, with the repo's commit-message style and trailers.
8. Before each commit run the repo's doc checks (here: `pnpm verify:docs` and `pnpm comments`; in a worktree with no install use the underlying `node scripts/…` commands that script runs). A dead link into `node_modules/` is expected without an install — ignore only that.
9. **Never `--no-verify`.** If a hook fails because the worktree has no `node_modules`, leave that change staged and report it; the coordinator commits it from the main checkout. Do not push.

## Report back
- commits (sha + subject) and the `git diff --stat <base>` summary
- per category: applied / skipped (id + reason)
- handoffs: `{file, what to change, item id}`
- bytes/lines before → after for each doc you edited
