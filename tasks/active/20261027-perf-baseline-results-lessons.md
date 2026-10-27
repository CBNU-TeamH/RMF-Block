# Record the v0.1.0 NFR-PER results — lessons

**Created**: 2026-10-27

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **H's state showed up in one direction only.** On battery, with other load, H put a ~2 s plateau on G→H only (#240). H timestamps a G→H receipt when it renders it, so a throttled H inflates that direction alone, while H→G looked normal.
- **The harness's HTTP probe reads about 2 × the path RTT.** It opens a new connection per sample. Its rise over baseline still confirms a preset; its absolute value is not the RTT.
- **Almost every replaced round came from the harness, not the product.** 48 of them: the old U rule (#215), the port race (#217) and hangs (#218). The product-failure candidates were 4 rounds (#236, #237, #239).

## What we would do differently

- **Check H's power source before every cell, not only at the start.** The runner began waiting for AC only after the 1st light and moderate runs had been taken on battery.
- **Run `perf:report` on a copy when checking a report change.** Running it on a raw run folder rewrites that run's summary files. This happened once, to `ramp2`: same values, new row order.
- **Write the results doc as numbers plus links from the start.** The first draft restated rules and issue state, and the review cut it from 238 to 216 lines.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- **For the runbook (§4 device hygiene):** H stays on AC with no other load for the whole campaign, and the runner refuses to start a cell on battery. The rig's scratch pipeline did this from 03:01 on 2026-10-27.
