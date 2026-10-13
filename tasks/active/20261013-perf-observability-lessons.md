# Observation stack and result charts for the perf campaign — lessons

**Created**: 2026-10-13

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **Spike (2026-10-13): cAdvisor on Docker Desktop (WSL2) cannot name containers.**
  - With the documented mounts, its Docker handler fails on every container ("failed to identify the read-write layer ID … `layerdb/mounts/<id>/mount-id`: no such file or directory"), and only the `/docker` aggregate is exported.
  - Docker Desktop's engine data lives in its own VM, and its image store does not have the layout cAdvisor reads.
  - Cutting the Docker handler off (`--docker=unix:///nonexistent.sock --raw_cgroup_prefix_whitelist=/docker/`) brings back per-container CPU and memory, keyed by `id="/docker/<full container id>"` but with no `name`. Network is not per container in this mode: only the host's `id="/"` has it, so per-container network stays in the harness's `docker stats` file.
- **Spike: Yorkie 0.7.23 serves `/metrics` on the profiling listener (8081) with no flag**, inside the round's network. The `yorkie_*` series seen on an idle stack:
  - `rpc_server_handled_total` and `rpc_server_handled_response_seconds`, labelled by `rpc_service`, `rpc_method` and `rpc_code`;
  - `pushpull_response_seconds`;
  - `pushpull_snapshot_duration_seconds`;
  - `user_agent_total`;
  - `server_version`.

  Under a round's load, the `Watch` method and an outage's `rpc_code="canceled"` show up as well (milestone 3).
- **Spike: a round's default network is `<project>-default`**, because `stackUp` renames declared networks, not `<project>_default`.
- **Spike: Observable Plot 0.6.17 renders static SVG in Node through happy-dom**, with no NaN, and passes `pnpm typecheck`. Its `document` option needs a cast from happy-dom's `Document`. Plot resolves d3 itself, so no separate `d3` dependency is needed.

## What we would do differently

- **Run Node-run entry points as `.mts` from the start.** A `.ts` module that Playwright imports is transpiled to CommonJS, so `import.meta.main` in `observe.ts` broke the harness ("Cannot use 'import.meta' outside a module"). The CLI moved to `observe-up.mts`, which is the repo's existing split (#189's lessons): modules Playwright imports are `.ts`, and scripts Node runs are `.mts`.
- **A one-point ECDF draws no line.** Plot's step line needs two points, so 003's single join per round was invisible until the curve also got dots.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- ...
