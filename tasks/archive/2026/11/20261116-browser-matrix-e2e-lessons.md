# Firefox and WebKit E2E runs — lessons

**Created**: 2026-11-16

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- `newCDPSession` throws on Firefox and WebKit, so eight specs that look unrelated (outage recovery, table races, IME) fail for the same tooling reason, not a product one.
- `test.skip(callback)` cannot be called inside a test body; `test.skip(test.info().project.name !== "chromium", reason)` can.
- Playwright's WebKit needs system libraries a fresh WSL distro lacks (`sudo playwright install-deps webkit`); Firefox did not.

## What we would do differently

- A run alongside other work (`tsc`, `eslint`) changed which WebKit specs failed; repeat before classifying, on a quiet machine. Three runs of the seven failing specs settled it: they fail, not flake.

## Worth extracting

- Nothing beyond what `docs/testing.md` now says ("Other browsers"). The seven WebKit failures are #253, not a convention.
