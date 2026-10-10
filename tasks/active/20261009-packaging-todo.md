# Packaging: a published image and the first release

**Created**: 2026-10-09
**Issue**: #160 (WBS 20.1), #161 (WBS 20.2)
**Design**: [ADR-009](../../docs/adr/009-distribution-ghcr-image-tag-release.md). No module design changes; the decision is the ADR.

## Milestones

### 1. Split the compose file into the host's file and the clone's override

- **What**: `docker-compose.yml` names the published image and pins the project name. A new `docker-compose.override.yml` adds `build: .` back, so a clone keeps building from source.
  - The default name is `name: rmf-block`. Starting from any folder with the same project name replaces the same containers and reattaches the same volumes. Older installations with another name must preserve it through `COMPOSE_PROJECT_NAME` in `.env`; otherwise fixed container names can collide and different volumes can open an empty workspace.
- **Files**: `docker-compose.yml`, `docker-compose.override.yml` (new).
- **Reuse**: Compose merges `docker-compose.override.yml` automatically when no `-f` is given. CI (`docker compose up -d --build app`), `pnpm docker:up` and `scripts/e2e-isolated.mjs` all run without `-f`. The isolated runner reads `docker compose config`, which includes the override, and overwrites `name` and `build.context` itself.
- **Done**:
  - In the repository, `docker compose config` shows `name: rmf-block` and, for `app`, both `build` and `image: rmf-block:dev`.
  - The same command in an empty folder holding only `docker-compose.yml` shows `image: ghcr.io/cbnu-teamh/rmf-block:latest` and no `build`.
  - `pnpm docker:up` comes up on the existing volumes with the documents still there.

### 2. A tag-triggered release workflow

- **What**: pushing `v*` does three things in order:
  1. Checks the tag against `package.json`, and on the upstream repository that the commit is on `main`, then requires HTTP 404 from the tag's GitHub Release lookup before building.
  2. Builds `linux/amd64` and `linux/arm64` and pushes them as one manifest list.
  3. Only then creates the GitHub Release. It attaches the compose file, rewritten to the exact version, and `.env.sample`, and puts the manifest-list digest in the notes.

  `-rc.N` tags make a prerelease and do not move `latest`. Runs for one tag cannot overlap and do not cancel an in-progress run. An existing release blocks another image push; failures before release creation remain retryable. Checkout does not persist credentials; release creation still uses `GH_TOKEN`.
- **Files**: `.github/workflows/release.yml` (new).
- **Reuse**: Docker's official actions (`setup-qemu`, `setup-buildx`, `login`, `metadata`, `build-push`). The metadata action generates the OCI labels, so the Dockerfile does not change. Login uses `GITHUB_TOKEN`; there is no new secret.
  - The image name is taken from the repository owner, lowercased. That lets the same workflow rehearse on the fork into `ghcr.io/taejinchoi-cbnu/rmf-block`.
- **Done**: see milestone 4.

### 3. Host and maintainer docs

- **What**:
  - **README**: the quick start becomes "download from the latest release, set `HOST_LAN_IP`, `docker compose up`", with separate Bash and PowerShell 5.1 commands. Upgrading runs `up` only after a successful `pull`; clone-to-release migration copies `.env` to a separate folder and preserves the existing project name. Pinning uses the manifest-list digest. Building from source moves to `CONTRIBUTING.md`.
  - **CONTRIBUTING**: a new "Releasing" checklist: rc publication, first package visibility change, anonymous-pull rehearsal, then final tag push.
  - **`.env.sample`**: the header covers both ways in.
  - **ADR-009**: the override is confirmed in its Consequences.
  - Also fixed while here: the README still puts the Admin link in the top bar, which #178 moved to the sidebar.
- **Files**: `README.md`, `CONTRIBUTING.md`, `.env.sample`, `docs/adr/009-distribution-ghcr-image-tag-release.md`, plus whichever owning docs the reminder names.
- **Reuse**: `.env.sample` already explains finding the LAN address on each OS. That is the host's path, because `scripts/detect-host-ip.sh` assumes the repository layout (`cd "$(dirname "$0")/.."`) and is not shipped.
- **Done**: `pnpm verify:docs` is clean, and following the README from an empty folder works (milestone 4).

### 4. Rehearse on the fork before the PR

- **What**: push `v0.0.1-rc.0` to the fork and walk the whole path.
- **Setup (by hand)**:
  1. Enable Actions on the fork.
  2. Give the fork's Actions write access to the existing personal package (package settings → Manage Actions access).
- **Done**:
  - The workflow is green. Its duration is recorded, because building arm64 under QEMU is the unknown.
  - `docker buildx imagetools inspect ghcr.io/taejinchoi-cbnu/rmf-block:0.0.1-rc.0` lists `linux/amd64` and `linux/arm64`, the labels carry `source`, `revision` and `licenses=MIT`, and `latest` did not move.
  - The prerelease has both files, the attached compose names `…:0.0.1-rc.0`, and the notes carry the digest.
  - An empty folder with only the two files comes up, and a guest on another device joins.
  - A tag whose version disagrees with `package.json` fails at the check, and no image or release is made.
  - The rc release and tag are deleted afterwards.

### 5. After merge: the real release

- **What**:
  1. Push `v0.0.1-rc.1` on upstream. An org owner makes the package public, and the teammate with a Mac reviews it.
  2. Push `v0.0.1`.
  3. ADR-009 becomes Accepted in the archive PR.
- **Done**: `v0.0.1` is the latest release, and `ghcr.io/cbnu-teamh/rmf-block:0.0.1` and `:latest` pull anonymously on amd64 and arm64.

## Test selection

Use [the test-selection workflow](../../docs/testing.md#select-tests-for-each-change) before
building and revisit it for the final behavior. For each relevant layer, name existing tests
that cover it, required updates/new cases, or a concrete reason no change is needed.

- Vitest (logic / component / server / route): no change. No application code changes.
- Browser E2E (`e2e/`): no new cases. The suite has to stay green through the override, because the isolated runner builds from `docker compose config`. Run `pnpm e2e:isolated` once locally, and let CI run it.
- Container smoke (`.github/workflows/ci.yml`): no change to the job. It is the check that the override still builds the app from source in CI. The published image is exercised by the fork rehearsal (milestone 4) instead, since CI never pushes.
- Commands and observed results (fill in before the PR):
  - `docker compose config` in the repository merges the override: `name: rmf-block`, and `app` with `build` and `image: rmf-block:dev`. In a folder with only `docker-compose.yml`: `image: ghcr.io/cbnu-teamh/rmf-block:latest`, no `build`.
  - `docker compose up -d --build --wait` in the repository: `rmf-app` runs `rmf-block:dev` in project `rmf-block`, on the existing `rmf-block_*` volumes (`Workspace "test" — saved settings`).
  - `pnpm e2e:isolated`: 21 passed (2.0m), through the override.
  - actionlint 1.7.7 on `release.yml`: clean. Both `run` steps were also run locally with test inputs; the results are under milestone 4 in Review.
  - Pre-push (Vitest and build): 748 passed, build succeeded.

## Acceptance

- [ ] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [ ] Milestones 1–4 meet their *Done*, with the fork rehearsal's outputs recorded in Review.
- [ ] CI is green on the PR, including container smoke and E2E.
- [ ] The README quick start works from an empty folder with only the release's files.

## Cross-cutting

- SRS: UC-010 (precondition: the image is available to the Host), HIR001, SOIR002.
- ADR-009 stays Proposed until milestone 5.
- Repository settings outside the code:
  - Actions on the fork (rehearsal only).
  - The org package's visibility, set once by an org owner after the first upstream rc succeeds and before the first final tag push.
- A host switching from a clone to a release shares the same volumes when the existing Compose project name is retained. The README covers older names as well as the `rmf-block` default.

## PR #181 review follow-up

- Scope: fix the existing-project migration and PowerShell 5.1 instructions, plus all four findings in [the CodeRabbit review](https://github.com/CBNU-TeamH/RMF-Block/pull/181#pullrequestreview-5467418145).
- Success criteria: Compose config retains both volume names for an older project and selects the GHCR image without a build in a release folder; PowerShell 5.1 parses the installation and upgrade commands, uses native `curl.exe`, and skips `up` when `pull` fails; the actual workflow lookup script allows only HTTP 404 and blocks HTTP 200/401/403/429/500 and network failures before image push.
- Test selection: execute the workflow shell block against controlled HTTP responses and check with actionlint; validate Compose config without starting containers and run PowerShell command checks with downloads in a temporary folder and a Docker stand-in. No new Vitest, browser E2E, or container-smoke cases: application code, images, startup, networking and Compose files are unchanged by this follow-up.
- Work stays on `feat/packaging`. No live stack, release, or package visibility changes; Apple Silicon execution is outside this follow-up. The personal Korean journal is updated locally and excluded from commits.
- Verification results (2026-10-09):
  - `python3 /tmp/rmf-181-verify.py`: the actual lookup shell block was extracted from `release.yml` and executed with Bash's runner flags against a local HTTP server. HTTP 404 reached a sentinel representing the next push; HTTP 200/401/403/429/500 and connection refusal exited nonzero before it. Static checks confirmed the lookup precedes `build-push`, no `continue-on-error` is present, checkout disables credential persistence, and same-tag concurrency does not cancel the running workflow. Hosted concurrency was not exercised because no tag was pushed.
  - The same harness used `docker compose config --format json` on a simulated older clone (no top-level `name`, folder `old-checkout`) and a release folder with a copied `.env` plus `COMPOSE_PROJECT_NAME=old-checkout`. Both selected `old-checkout_app-data` and `old-checkout_mongo-data`; the release selected `ghcr.io/cbnu-teamh/rmf-block:0.0.1` with no `build`. Removing the project override selected the default `rmf-block_*` volumes instead. No containers were started or changed.
  - `powershell.exe -NoProfile -ExecutionPolicy Bypass -File '\\wsl.localhost\Ubuntu\tmp\rmf-181-powershell.ps1'`: PowerShell 5.1.26100.9444 parsed all three README PowerShell blocks. Native `curl.exe` downloaded temporary file-URL fixtures with `-LO` and `-L -o .env`; folder creation and `Set-Location` worked. With a Docker stand-in, successful `pull` ran `up -d`, failed `pull` skipped it, and the inspect JSON pipeline returned the older project name. Reproduced the original `&&` parse failure (`InvalidEndOfLine`) and the `curl` alias failure (`NamedParameterNotFound`). This checks syntax and local command behavior, not a live installation or GitHub download.
  - `docker run --rm -v /mnt/c/Users/user/Desktop/rmf-block:/repo -w /repo rhysd/actionlint:1.7.7 .github/workflows/release.yml`: clean.
  - `pnpm verify:docs`, `pnpm comments`, and `git diff --check`: clean.

## Host LAN IP guidance follow-up

- Scope: expand the root README and `.env.sample` instructions for Windows, macOS and Linux. Keep manual release setup and the existing clone-only detector; no new scripts or runtime changes.
- Success criteria: users can identify the IPv4 address of the connection shared with guests and set `HOST_LAN_IP`; Windows instructions run outside WSL, macOS instructions discover the device instead of assuming `en0`, and Linux instructions omit the address prefix.
- Test selection: documentation and environment-file comments only. No new Vitest, browser E2E or container-smoke tests are needed because startup, networking and configuration values are unchanged. Run `pnpm verify:docs`, `pnpm comments` and `git diff --check`; execute the read-only Windows and Linux lookup commands where available and check macOS commands against vendor documentation.
- Command checks: `ip -4 addr show scope global` ran successfully in the local WSL environment; Windows PowerShell `ipconfig` ran successfully and listed the connected Wi-Fi IPv4 address. These checks do not prove guest connectivity. Apple's interface lookup guide confirms `networksetup -listallhardwareports`, and its [ipconfig manual](https://github.com/apple-oss-distributions/bootp/blob/main/ipconfig.tproj/ipconfig.8) documents `getifaddr`. macOS execution requires a Mac and was not performed here.
- Documentation checks: `pnpm verify:docs`, `pnpm comments` and `git diff --check` passed. Configuration values and runtime code are unchanged.

## Native Yorkie environment examples follow-up

- Scope: comment out the two native-only Yorkie overrides in `.env.sample`, supply concrete Docker Desktop examples, and distinguish native setup from full Compose execution in README and CONTRIBUTING. The shared sample still serves release users through `HOST_LAN_IP`.
- Success criteria: a copied sample leaves the native startup defaults available rather than overriding them with empty strings; full Compose keeps its existing internal addresses; users know that CI and isolated E2E obtain these addresses from Compose.
- Test selection: verify sample parsing against the address expressions in `instrumentation.ts`, compare resolved full Compose configuration using the committed and edited samples, then run `pnpm verify:docs`, `pnpm comments` and `git diff --check`. No new Vitest, browser E2E or container-smoke cases: application code, Compose configuration and container startup are unchanged; the sample changes native environment preparation. No host `.env` or live containers are changed.
- Results: Node's `parseEnv` found neither Yorkie override in the edited sample; evaluating the actual startup address expressions against it returned the documented localhost Admin URL and Docker Desktop webhook URL. `docker compose config --format json` with the old and new samples produced identical full configurations. `pnpm verify:docs`, `pnpm comments` and `git diff --check` passed. Native webhook reachability was not tested; it depends on the developer's network setup.

## Retry and `latest` follow-up

- Scope: [the open CodeRabbit thread](https://github.com/CBNU-TeamH/RMF-Block/pull/181#discussion_r4228429446) (a retry after a failed release re-pushes `X.Y.Z`), the `/simplify` and `/code-review` findings on `release.yml`, and short recovery and rollback guidance. Explicit deployment stages, automatic rollback and release or package cleanup are out of scope.
- Success criteria: a retry reuses an existing `X.Y.Z` whose revision label matches the tag's commit and fails on a mismatch or a registry error; `latest` moves only after the release exists, and only for a final version; the release lookup still allows only HTTP 404.
- Test selection: run the actual `Check the image` and release lookup blocks from `release.yml` against GHCR and the GitHub API, then actionlint. No new Vitest, browser E2E or container-smoke cases: application code, images, Compose files and startup are unchanged.
- Results (2026-10-10):
  - `Check the image` against the fork's `0.0.1-rc.0`: with `GITHUB_SHA=78718b9…` it output `digest=sha256:5776b6c8…`; with another SHA it failed naming both revisions; a missing tag (`9.9.9`) passed as absent; an anonymous lookup of a missing package failed closed on 403. An authenticated manifest request for a missing package returns 404, so the first upstream push should pass as absent; the upstream rc confirms it.
  - Release lookup: an existing release failed, a missing one passed, a bad token (HTTP 401) and an unreachable host failed.
  - actionlint 1.7.7: clean. `pnpm verify:docs`, `pnpm comments` and `git diff --check`: clean.
  - Fork rehearsal, `v0.0.1-rc.1` on `ca7e369`, run 37968412085:
    - Attempt 1: success in 6m 15s. `Check the image` passed as absent, the build pushed `0.0.1-rc.1` as `sha256:ff9716d1…` (`linux/amd64`, `linux/arm64`, `revision=ca7e369`), the prerelease was created with that digest, and `Move latest` was skipped; `latest` does not exist on the fork.
    - The release was then deleted, keeping the tag. Attempt 2: success in 36 s. `Check the image` reused the digest, metadata and build were skipped, and the prerelease was recreated with the same digest and both assets.
    - Attempt 3: failed at `Check the release does not exist` with "Release v0.0.1-rc.1 already exists".
  - Not exercised: `Move latest`, which runs only for a final tag. It runs first on the upstream `v0.0.1`; if it fails, re-running the run retries it (see the next follow-up).
- Skipped: moving the native-only variables out of `.env.sample` and removing README's per-OS lookup (both were chosen in the two previous follow-ups); generalising the image name in the `sed` pattern; the render-time state update in `document-tabs.tsx` (no failure found, and outside this PR).

## Resumable re-run follow-up

- Scope: [the CodeRabbit thread](https://github.com/CBNU-TeamH/RMF-Block/pull/181#discussion_r4232961042) — a failed `Move latest` could not be retried, because a re-run stopped at the release check. Fixed across every state a re-run can meet, not only that step.
- Success criteria: a re-run after a failure at any step finishes the remaining steps; a re-run of a finished run changes nothing; an existing release is passed only when its notes name the reused image's digest; `latest` moves only for the tag GitHub marks as the latest release, so re-running an older tag never moves it back; no state builds over a published version.
- Test selection: run the actual `Check the release` and `Move latest` blocks against the GitHub API (docker stubbed for the `latest` push), then actionlint. `Check the image` changed only its message. No new Vitest, browser E2E or container-smoke cases: application code, images, Compose files and startup are unchanged.
- Results (2026-10-10):
  - `Check the release` on the fork: `v0.0.1-rc.1` with its digest `sha256:ff9716d1…` passed and marked the release as existing; with another digest, or with no image, it failed with "publish a new version"; a missing release passed; a bad token (HTTP 401) failed.
  - `Move latest`: on `cli/cli`, its latest release tag moved `latest` (stub) and `v2.0.0` left it with a notice; on the fork, which has no latest release (HTTP 404), the step failed rather than guess.
  - actionlint 1.7.7: clean. `pnpm verify:docs`, `pnpm comments` and `git diff --check`: clean.

## Review

Filled in at the end: what shipped, what was cut, what moved to another task.

### Fork rehearsal (milestone 4), 2026-10-09

- **`v0.0.1-rc.0` on `taejinchoi-cbnu/RMF-Block`, run 37899242115: success in 8m 4s.** The build-push step took 7m 12s, for amd64 and arm64 under QEMU with a cold `gha` cache.
- **`ghcr.io/taejinchoi-cbnu/rmf-block:0.0.1-rc.0`** is the manifest list `sha256:5776b6c8…`, with `linux/amd64`, `linux/arm64` and two attestations. Both images carry `licenses=MIT`, `source` and `revision=78718b9`. No `latest` was created.
- **The prerelease** has `docker-compose.yml` (image `…:0.0.1-rc.0`) and `env.sample`, and its notes give the same digest. With no merged PRs on the fork, the generated part is only the "Full Changelog" link.
- **From a folder with only those two files** (`curl` as in the README, `HOST_LAN_IP` filled in), `docker compose up -d --wait` replaced only `rmf-app`, with the released image. It kept the running Yorkie and MongoDB, in the same project `rmf-block`, and reattached the existing volumes (`Workspace "test" — saved settings`). There was no `container_name` collision.
- **`v9.9.9-rc.0`, run 37900711265**: failed at "Check the tag" with "does not match package.json's version 0.0.1". Every later step was skipped, and no image or release exists for it. The tag was deleted afterwards.
- **Locally**, the "Check the tag" script was also run against these cases, with a `jq` stand-in:
  - On upstream, a tag on a branch commit fails with "is not on main".
  - On upstream, a tag on a `main` commit passes, and the image is `ghcr.io/cbnu-teamh/rmf-block`.
