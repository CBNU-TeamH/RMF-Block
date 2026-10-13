# Observation stack and result charts for the perf campaign — lessons

**Created**: 2026-10-13

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **Spike (2026-10-13): cAdvisor on Docker Desktop (WSL2) cannot name containers.**
  - With the documented mounts, its Docker handler fails on every container ("failed to identify the read-write layer ID … `layerdb/mounts/<id>/mount-id`: no such file or directory"), and only the `/docker` aggregate is exported.
  - Docker Desktop's engine data lives in its own VM, and its image store does not have the layout cAdvisor reads.
  - Cutting the Docker handler off (`--docker=unix:///nonexistent.sock --raw_cgroup_prefix_whitelist=/docker/`) brings back per-container CPU, memory and network, keyed by `id="/docker/<full container id>"` but with no `name`.
- **Spike: Yorkie 0.7.23 serves `/metrics` on the profiling listener (8081) with no flag**, inside the round's network. The `yorkie_*` series seen on an idle stack:
  - `rpc_server_handled_total` and `rpc_server_handled_response_seconds`, labelled by `rpc_service`, `rpc_method` and `rpc_code`;
  - `pushpull_response_seconds`;
  - `pushpull_snapshot_duration_seconds`;
  - `user_agent_total`;
  - `server_version`.

  More may appear only under load; recheck in milestone 3.
- **Spike: a round's default network is `<project>-default`**, because `stackUp` renames declared networks, not `<project>_default`.
- **Spike: Observable Plot 0.6.17 renders static SVG in Node through happy-dom**, with no NaN, and passes `pnpm typecheck`. Its `document` option needs a cast from happy-dom's `Document`. Plot resolves d3 itself, so no separate `d3` dependency is needed.

## What we would do differently

- ...

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- ...
