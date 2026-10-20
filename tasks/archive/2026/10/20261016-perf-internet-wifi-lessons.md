# Perf campaign on an internet Wi-Fi, run with Claude — lessons

**Created**: 2026-10-16

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- In WSL mirrored mode on a Windows H, a container on port 3000 answered on `127.0.0.1` but timed out on H's own Wi-Fi address, until `hostAddressLoopback=true` was set and WSL restarted. Every `never served /join` failure on the hotspot that day had this cause, plus one run with `<H_IP>` typed literally.
- The Hyper-V firewall's default inbound action for WSL is Block, so the G-only rule on a Windows H is the only way in.
- Docker-published ports skip ufw, so a Linux H has to limit 3000/8080 in `DOCKER-USER`.

## What we would do differently

- Run the rehearsal before opening the PR. It needed G on the new Wi-Fi, so the acceptance box stayed open until the v0.1.0 campaign met it.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- None.
