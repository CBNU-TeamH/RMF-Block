# tasks:archive on macOS: edit files without `sed -i` — lessons

**Created**: 2026-11-24

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- A shim that rejects the GNU spelling is enough to reproduce a BSD-only failure on Linux, and the same shim proves the old script fails, so the check is not vacuous.


## What we would do differently

- Run the old and the new script against the same scratch fixture before writing the task's results; it makes the "fails before, passes after" claim cheap.


## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- Nothing yet.

