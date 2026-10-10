# ADR-009: Distribute a multi-arch image on GHCR, released from a git tag

- **Status**: Proposed. It becomes Accepted when #160 and #161 merge, and is corrected there if the build proves a point wrong.
- **Date**: 2026-10-09
- **Related**: [`docs/SRS-en.md`](../SRS-en.md) UC-010 (precondition: the image "is available to the Host"), HIR001, SOIR002; [ADR-005](005-custom-server-rest-ws.md) (why the image carries a full `node_modules`); issues #160 (WBS 20.1), #161 (WBS 20.2)

## Context

UC-010's precondition is that the project's Docker image is available to the Host. Today it is not: `docker-compose.yml` builds the app from source (`build: .`), so every host needs a clone and spends minutes compiling Next.js and installing dependencies before the first start. Yorkie and MongoDB are already pulled as published images.

There are no git tags, no releases and no published image. `main` is always releasable (AGENTS.md §6), so "the version we demo" is whatever `main` happened to be.

The hosts are team members' laptops: Windows and Linux on x86-64, and Apple Silicon Macs on arm64. Both `yorkieteam/yorkie:0.7.23` and `mongo:8` are published as multi-arch images with `linux/amd64` and `linux/arm64` in their manifest lists. The app image built today is `linux/amd64` only.

## Decision

1. **Publish a prebuilt app image to GitHub Container Registry**, as `ghcr.io/cbnu-teamh/rmf-block`. A host downloads the compose file and `env.sample` (the repository's `.env.sample`, renamed because GitHub renames an asset with a leading dot) from a release, then runs `docker compose up` without cloning or building anything.
2. **One tag, two architectures.** The image is built for `linux/amd64` and `linux/arm64` and pushed as one manifest list. An Apple Silicon host pulls the arm64 image natively, with no emulation. The Dockerfile does not change: `node:24-alpine` is itself multi-arch, and `pnpm install` picks the matching native binaries.
3. **A pushed git tag is the release, and the workflow orders the steps.** A human pushes `vX.Y.Z` on a commit already on `main`. One workflow then:
   1. checks the version against `package.json` and the commit is on `main`;
   2. checks what an earlier run of the same tag already published: an `X.Y.Z` image is reused only if its revision label is the tag's commit, and a GitHub Release only if its notes name that image's digest. Only HTTP 404 counts as no release; anything else it cannot vouch for stops the workflow;
   3. builds and pushes the image as `X.Y.Z` if none was reused;
   4. only if that succeeded, creates the GitHub Release with generated notes, the compose files attached, and the image's manifest-list digest in the notes, unless it already exists;
   5. only then, for the final-version tag GitHub marks as the latest release, points `latest` at that digest.

   A release therefore never exists without its image, and `latest` follows the latest release, never ahead of it and never back to an older one. A `-rc.N` tag runs the same path as a prerelease and does not move `latest`.
4. **No release branch.** A release is a tag on `main`. A `release/X.Y` branch is cut from the tag only if an old version ever needs a fix while `main` has moved on.
5. **Published version tags are immutable; only `latest` moves.** Runs for the same tag share a concurrency group with `cancel-in-progress: false`, so a later run checks for the release after the earlier run finishes. Once the GitHub Release exists, the workflow never builds or pushes that version again. A failed run is retried by re-running it, at any step: it resumes rather than starts over (Decision 3.2), and re-running a finished run changes nothing. A tag re-pushed to another commit stops at the image check. Compose names the image by version tag, because it is readable and is bumped in one place; the notes record the manifest-list digest.
6. **Recovery and rollback are different problems.** A failed run is recovered by retrying it (Decision 5). A released version found faulty is not deleted or overwritten: hosts return to the previous release's compose file, and the fix ships as a new version. Nothing rolls back automatically; each host chooses its version.
7. **Yorkie and MongoDB stay bundled.** Compose always runs its own pinned Yorkie and MongoDB. Docker already reuses those images when they are present locally. Attaching to a Yorkie or MongoDB server the host already runs is not supported, for three reasons:
   - The browser derives Yorkie's address from the page's host and port 8080 (`lib/yorkie-address.ts`).
   - Startup writes the auth webhook onto the Yorkie project, which would overwrite another deployment's setting.
   - The client is a patched `@yorkie-js/sdk@0.7.23`, so the server version has to match.

## Alternatives considered

- **Docker Hub**: rejected.
  - Pushing from Actions would need a Docker Hub account and an access token stored as a repository secret, which expires and belongs to one person. GHCR accepts the workflow's own `GITHUB_TOKEN` with `packages: write`.
  - GHCR's namespace is the GitHub organisation, and the package links to the repository and follows its permissions.
  - Docker Hub's advantages are a registry prefix that can be omitted and discoverability. Neither matters for a LAN capstone.
  - Its anonymous pull limit is not decisive either, because Yorkie and MongoDB are pulled from Docker Hub anyway.
- **Keep building from source on the host**: rejected. UC-010 asks for an available image, and a host should not need Node, pnpm or the repository to run a release.
- **`amd64` only**: rejected. Apple Silicon hosts would run the image under emulation, which is slower and occasionally unstable, and an arm64 Linux host without emulation fails with `exec format error`.
- **Trigger on `release: published`**: rejected. It runs after the release exists, so for the length of the build a release would point at an image that is not there yet.
- **Support an external Yorkie or MongoDB**: deferred. The three reasons in Decision 7 make it a code change, not a configuration change. It is not needed for v0.0.1.

## Consequences

- Host instructions change. The README's quick start becomes "download from the release, set `HOST_LAN_IP`, `docker compose up`", and building from source moves to `CONTRIBUTING.md`.
- `docker-compose.yml` names the published image. Development, CI and `pnpm e2e:isolated` still build from source: `docker-compose.override.yml`, which only a clone has, adds `build: .` back, and Compose merges it whenever no `-f` is given.
- The compose file defaults to `name: rmf-block`, so a clone and a release using that name share one workspace. An older installation may have used a different project name. Before switching to release files in a separate folder without the clone's override, read the existing container's Compose label and set `COMPOSE_PROJECT_NAME` in the copied `.env` to preserve its containers and volume names ([README](../../README.md#upgrading)). `down` alone does not transfer data to a new project name.
- The arm64 half is built under QEMU on an x86-64 runner, so a release build takes several times longer than CI's. If that becomes painful, the fix is a native `ubuntu-24.04-arm` runner and a manifest merge step, not dropping arm64.
- An organisation package is private on its first push. On the first release, an org owner makes it public after the rc is published and before the final tag is pushed.
- `package.json`'s `version` and the tag have to agree. The release checklist in `CONTRIBUTING.md` says so.
- The image is about 945 MB, mostly `node_modules`, because ADR-005 rules out `output: "standalone"`. Trimming it, starting with the unused glibc `@next/swc` binary on an Alpine base, is separate work.
