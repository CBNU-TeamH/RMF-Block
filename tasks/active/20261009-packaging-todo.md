# Packaging: a published image and the first release

**Created**: 2026-10-09
**Issue**: #160 (WBS 20.1), #161 (WBS 20.2)
**Design**: [ADR-009](../../docs/adr/009-distribution-ghcr-image-tag-release.md). No module design changes; the decision is the ADR.

## Milestones

### 1. Split the compose file into the host's file and the clone's override

- **What**: `docker-compose.yml` names the published image and pins the project name. A new `docker-compose.override.yml` adds `build: .` back, so a clone keeps building from source.
  - The pinned name is `name: rmf-block`. With it, starting the stack from any folder replaces the same containers and reattaches the same volumes, where today it collides on `container_name` or starts an empty workspace. Both were seen in a manual run on 2026-10-09.
- **Files**: `docker-compose.yml`, `docker-compose.override.yml` (new).
- **Reuse**: Compose merges `docker-compose.override.yml` automatically when no `-f` is given. CI (`docker compose up -d --build app`), `pnpm docker:up` and `scripts/e2e-isolated.mjs` all run without `-f`. The isolated runner reads `docker compose config`, which includes the override, and overwrites `name` and `build.context` itself.
- **Done**:
  - In the repository, `docker compose config` shows `name: rmf-block` and, for `app`, both `build` and `image: rmf-block:dev`.
  - The same command in an empty folder holding only `docker-compose.yml` shows `image: ghcr.io/cbnu-teamh/rmf-block:latest` and no `build`.
  - `pnpm docker:up` comes up on the existing volumes with the documents still there.

### 2. A tag-triggered release workflow

- **What**: pushing `v*` does three things in order:
  1. Checks the tag against `package.json`, and on the upstream repository that the commit is on `main`.
  2. Builds `linux/amd64` and `linux/arm64` and pushes them as one manifest list.
  3. Only then creates the GitHub Release. It attaches the compose file, rewritten to the exact version, and `.env.sample`, and puts the manifest-list digest in the notes.

  `-rc.N` tags make a prerelease and do not move `latest`.
- **Files**: `.github/workflows/release.yml` (new).
- **Reuse**: Docker's official actions (`setup-qemu`, `setup-buildx`, `login`, `metadata`, `build-push`). The metadata action generates the OCI labels, so the Dockerfile does not change. Login uses `GITHUB_TOKEN`; there is no new secret.
  - The image name is taken from the repository owner, lowercased. That lets the same workflow rehearse on the fork into `ghcr.io/taejinchoi-cbnu/rmf-block`.
- **Done**: see milestone 4.

### 3. Host and maintainer docs

- **What**:
  - **README**: the quick start becomes "download from the latest release, set `HOST_LAN_IP`, `docker compose up`", followed by upgrading (`docker compose pull && docker compose up -d`) and pinning by manifest-list digest. Building from source moves to `CONTRIBUTING.md`.
  - **CONTRIBUTING**: a new "Releasing" checklist.
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
  - The org package's visibility, set once by an org owner after the first upstream push.
- A host who started from a clone and later uses a release shares the same volumes, because of `name: rmf-block`. This is intended.

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
