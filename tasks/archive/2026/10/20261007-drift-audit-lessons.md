# Drift audit: the parts that changed since 2026-10-05 — lessons

**Created**: 2026-10-07

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- The new conventions rule's own example (`e2e/perf/`) tripped the very check it describes, and
  the failure was swallowed because `pnpm verify:docs` was piped into `grep` before `&&` — the
  commit landed. Caught on the next look, amended before push. A check piped into a filter
  reports the filter's exit code.
- An audit that fixes a claim in one doc can leave a second copy in a code comment
  (`lib/files/types.ts`); round 1's "nothing lost" lens is what found it.
- A sentence written to record a lesson made a claim nobody had measured (sub-agent model
  override) — round 2 caught it against the measured section right above it.
- The PR review found that copying `.env.sample` preserves empty Yorkie addresses, which
  suppress the startup's `??` defaults. Native-development setup must specify those addresses;
  Compose's app environment overrides do not configure the native app process.

## What we would do differently

- Grep the whole repo, comments included, for a claim before fixing it in one doc.
- Run doc checks bare, or capture the exit status, before chaining a commit on them.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- Nothing new beyond what this audit already promoted.
