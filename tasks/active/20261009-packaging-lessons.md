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
- **A default Compose project name does not migrate older volumes.** Read the running or stopped app container's Compose label and preserve it through `COMPOSE_PROJECT_NAME` when switching to a release folder. Removing containers alone does not transfer data.
- **PowerShell 5.1 has a `curl` alias and cannot parse `&&`.** Use `curl.exe`, separate folder creation from `Set-Location`, and guard `up` with `$LASTEXITCODE` after `pull`.
- **An unsuccessful release lookup does not prove absence.** Only HTTP 404 permits publishing; existing releases and lookup failures stop before building. Serialize runs for the same tag so both cannot pass the absence check at once.
- **LAN IP lookup needs an adapter choice.** Windows users query Windows rather than WSL; macOS users look up the hardware device instead of assuming `en0`; Linux users copy the LAN interface's IPv4 without its prefix. Release files do not include the clone's detection script.
- **An empty environment value is not an absent one.** Native Yorkie startup uses `??` defaults, so active empty assignments in a shared sample prevent fallback. Commented override examples preserve the defaults, while full Compose supplies its own internal addresses.
- **A registry tag is mutable, so a retry must look before it pushes.** Checking only the GitHub Release let a re-run push a new digest under a version an earlier run had already pushed. The image check reuses the existing digest when the revision label matches.

## What we would do differently

- Check `docker ps -a`, not `docker ps`, before starting a second stack.

## Worth extracting

- None for this follow-up: the migration and shell instructions belong in the README, and the publication guard belongs in ADR-009.
