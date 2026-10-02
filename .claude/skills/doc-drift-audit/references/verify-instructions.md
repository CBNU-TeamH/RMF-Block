# Verify instructions

Read-only. Read files **from disk as they are now**. Check expected HEAD first.

## Part 1 — after the audit: verify every A and F finding
A previous auditor produced false positives (it described text that had already been fixed). For each finding with `cat` A or F:
1. Open the cited doc at the cited place (grep if lines drifted) — does it really say what `claim` says, right now?
2. Open the cited code — does it really contradict the doc (F: is the code really wrong)?
3. Verdict: `confirmed`, `false` (the doc doesn't say it / the code doesn't contradict it), or `partial` (true, but the fix is wrong or overstated — give the corrected fix).
4. Score 0–100 how sure you are, using this scale verbatim: **0** false positive or pre-existing by design · **25** could be real, not verified · **50** real but a nitpick · **75** very likely real and it matters · **100** certain, confirmed in the code. Anything **below 80 is reported as `false`** unless you can raise it by reading more.

With more than ~60 findings, split them across several verifiers (by part); each verifies only its share.

Write `verify-AF.json`: `{"results":[{"id":"…","verdict":"confirmed|partial|false","score":0,"note":"one sentence"}]}`. Report counts per verdict and the false/partial ids with one line each.

## Part 2 — after integration: nothing lost, nothing dangling
Compare the base ref with the working tree (`git diff <base> -- <file>`).
1. Every fact moved between docs exists at its new owner, with its qualifiers (versions, issue numbers, requirement ids).
2. Every source that lost a fact links to the new location.
3. Every relative link and **every `#anchor`** resolves to a real file and heading (repo-wide grep for links into the changed docs).
4. Spot-check a handful of A edits against the code they describe.
5. Archived docs: nothing still routes readers to the old path.

Your prompt names your round's **lens** (1 nothing lost · 2 edits are true · 3 rest of the diff) — focus there, but report anything blocking you see. If you are given `rebuttals.md`, judge each rebuttal: accept it, or re-raise the finding with new evidence.

Report OK or PROBLEM per check, with `file:line` and one sentence for each problem, and mark each problem **blocking** (wrong fact, lost fact, broken link, behaviour change) or **minor** (wording).
