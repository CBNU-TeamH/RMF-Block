# Security, safety and reliability E2E — lessons

**Created**: 2026-11-16

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- Two of the five requirements the D07 gap list named were already covered: `collaboration.e2e.ts` reloads after editing (NFR-SAF-001) and `tree.e2e.ts` cancels then confirms a delete (NFR-SAF-002 for documents). Reading the specs first cut the task to three milestones.

## What we would do differently

- The first `--repeat-each=3` run failed twice for a test reason: the stack keeps chat history, so a repeated, identical message matched the earlier run's row. Anything a spec sends to chat carries `Date.now()`.

## Worth extracting

- Run a new E2E with `--repeat-each=3` on one stack before trusting it: shared state (chat history, members) only shows up on a repeat.
