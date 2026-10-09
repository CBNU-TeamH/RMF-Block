# Packaging: a published image and the first release — lessons

**Created**: 2026-10-09

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **`.dockerignore` decides what a rebuild sees.** Editing `README.md` left every build step `CACHED`, because `*.md` never reaches the build context. A one-line change to `package.json` (the `license` field) re-ran both `pnpm install` stages, about six minutes on WSL.
- **A stopped container still holds its `container_name`.** A second stack started from another folder failed with "The container name "/rmf-mongo" is already in use". `docker ps` showed nothing; `docker ps -a` showed the repository's stack, stopped but not removed.
- **GHCR's package page lists the attestation as a second "OS/Arch"** (`unknown/unknown`), and its suggested `docker pull …@sha256:` pins one platform's manifest, not the multi-arch list.
- **`gh auth refresh` uses the device flow.** It shows a one-time code to enter at github.com/login/device, and sends no GitHub Mobile prompt.
- **GitHub renames a release asset whose name starts with a dot**, so `.env.sample` is attached as `env.sample`. The README saves it straight to `.env` with `curl -L -o .env …/env.sample`.
- **A tag push runs the pre-push hook too**, so the full test suite and build run (about two minutes) for a push that carries no code.

## What we would do differently

- Check `docker ps -a`, not `docker ps`, before starting a second stack.

## Worth extracting

- ...
