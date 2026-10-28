# Release build: fail fast on a QEMU hang, and pin binfmt — lessons

**Created**: 2026-10-28

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **A workflow that only runs on a tag cannot be verified in its own PR.** Here the release candidate tag is the test. Since that run happens after the merge, the task is archived only after it passes.

## What we would do differently

- **Give a long job a `timeout-minutes` when it is written.** Most of `ci.yml`'s jobs had one, and `release.yml`, the longest, did not.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- Nothing yet.
