# Perf harness counts the clock residual, not the drift, in U — lessons

**Created**: 2026-10-20

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- OS time sync cannot help: the harness reads `performance.timeOrigin + performance.now()`, a monotonic clock that Windows w32time never slews. H's own ~10 ppm rate error showed up as G's drift, and chrony on G plus w32time on H left U unchanged (10.8–11.9 ms).
- θ_H compares two clocks on the same machine, so it can never show H's drift; only θ_G, measured against H, does.

## What we would do differently

- ...

## Worth extracting

- ...
