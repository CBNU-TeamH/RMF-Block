#!/usr/bin/env bash
# Detects the host's LAN IP and writes it into .env as HOST_LAN_IP, so guests
# can reach `docker compose up` without the host copy-pasting an address by
# hand every time. Also flags (but does not fix) WSL2 mirrored networking,
# since Docker Desktop can otherwise bind guests out. See README.md "Running it".
#
# Two platforms only: Linux and macOS. A Windows host runs Docker Desktop on
# the WSL2 backend, so `pnpm docker:up` lands in WSL and the Linux branch is the
# right one there -- see the mirrored-networking note at the bottom for the
# one case where that assumption bites.
set -euo pipefail
cd "$(dirname "$0")/.."

is_wsl() {
  grep -qi microsoft /proc/version 2>/dev/null
}

# Git Bash / MSYS: a Windows shell with none of the tools below. `bash` on a
# Windows PATH can resolve to either this or WSL, so say which one we landed in
# rather than reporting a generic detection failure.
is_msys() {
  grep -qiE 'mingw|msys' /proc/version 2>/dev/null
}

is_nat_range() {
  # 172.16.0.0/12 is where Docker and WSL2 put their own virtual networks.
  local a b
  IFS=. read -r a b _ _ <<<"$1"
  [[ "$a" == "172" && "$b" -ge 16 && "$b" -le 31 ]]
}

# 169.254/16 is APIPA -- what an interface falls back to when DHCP fails. It
# does not route past the local segment, so it is never an answer worth giving
# a guest. Both detectors drop it, so neither can offer what the other rejects.
drop_link_local() {
  grep -v '^169\.254\.' || true
}

# The address on the interface carrying the default route -- by definition the
# one a LAN peer reaches us on. Empty when there is no default route at all.
# This is a fact from the routing table, not a guess from the address value.
detect_primary() {
  local iface
  if command -v ip >/dev/null 2>&1; then
    # Anchor on the `dev` keyword, not field position: a point-to-point default
    # route has no `via` hop (`default dev tun0 scope link`), which shifts every
    # field left by two.
    iface=$(ip route show default 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "dev") { print $(i + 1); exit } }')
    [[ -n "$iface" ]] || return 0
    ip -4 -o addr show dev "$iface" 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | drop_link_local
  else
    iface=$(route -n get default 2>/dev/null | awk '/interface:/{print $2; exit}')
    [[ -n "$iface" ]] || return 0
    ipconfig getifaddr "$iface" 2>/dev/null | drop_link_local
  fi
}

# Every address a guest could conceivably use, for the "other candidates" hint
# and for the fallback when there is no default route.
detect_all() {
  local iface
  if command -v ip >/dev/null 2>&1; then
    ip -4 -o addr show scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | drop_link_local
  else
    for iface in $(ifconfig -l 2>/dev/null); do
      ipconfig getifaddr "$iface" 2>/dev/null || true
    done | drop_link_local
  fi
}

primary_raw=$(detect_primary || true)
chosen=$(printf '%s\n' "$primary_raw" | grep -v '^[[:space:]]*$' | head -n 1 || true)

all_raw=$(detect_all || true)
candidates=$(printf '%s\n' "$all_raw" | grep -v '^[[:space:]]*$' | awk '!seen[$0]++' || true)

if [[ -z "$chosen" ]]; then
  # No default route -- isolated LAN, or static addressing with no gateway.
  # Only here does the 172.16/12 heuristic earn its keep: it is a guess, not a
  # fact, and it is wrong on any campus LAN that legitimately lives in that
  # range. It must never re-rank an answer the routing table already gave us.
  best=""
  fallback=""
  while read -r ip; do
    [[ -n "$ip" ]] || continue
    if is_nat_range "$ip"; then
      fallback="${fallback:-$ip}"
    else
      best="${best:-$ip}"
    fi
  done <<<"$candidates"
  chosen="${best:-$fallback}"
fi

if [[ -z "$chosen" ]]; then
  if is_msys; then
    echo "[detect-host-ip] Running under Git Bash / MSYS, which this script does not support."
    echo "  Docker Desktop runs on the WSL2 backend, so run 'pnpm docker:up' from a"
    echo "  WSL shell instead -- or run 'ipconfig' on Windows and put that address"
    echo "  in .env as HOST_LAN_IP=<address>."
  else
    echo "[detect-host-ip] Could not detect a LAN IP automatically."
    echo "  Find it yourself -- 'ip -4 addr' on Linux (including WSL), or"
    echo "  'ipconfig getifaddr en0' on macOS -- then put that address in .env"
    echo "  as HOST_LAN_IP=<address>."
  fi
  exit 0
fi

if [[ ! "$chosen" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
  echo "[detect-host-ip] Detected '$chosen', which is not an IPv4 address -- .env not written."
  echo "  Put HOST_LAN_IP=<your LAN address> in .env yourself."
  exit 0
fi

# Rewrite through a sibling temp file rather than `sed -i`: the in-place flag
# takes a mandatory suffix argument on BSD sed (macOS), where the GNU spelling
# fails outright -- and under `set -e` that would take `docker compose` down
# with it. Dropping every existing HOST_LAN_IP line first also collapses
# duplicates left behind by a hand-edited .env.
env_file=".env"
tmp_file="$env_file.tmp.$$"
touch "$env_file"
grep -v '^HOST_LAN_IP=' "$env_file" >"$tmp_file" || true
printf 'HOST_LAN_IP=%s\n' "$chosen" >>"$tmp_file"
mv -f "$tmp_file" "$env_file"

echo "[detect-host-ip] HOST_LAN_IP set to $chosen (.env updated)."
others=$(echo "$candidates" | grep -vxF "$chosen" || true)
if [[ -n "$others" ]]; then
  echo "  Other candidates found: $(echo "$others" | tr '\n' ' ')"
  echo "  If guests can't connect, try one of those instead."
fi

# --- Mirrored networking check (WSL2 only) ---------------------------------
# This is also the guard for the assumption at the top of the file. Without
# mirrored networking, WSL2's own eth* sits on a private NAT that is *not* the
# Windows host's LAN address, so the address chosen above is likely wrong.
if is_wsl; then
  # powershell.exe is only used to locate %UserProfile% -- the Windows user
  # name need not match the WSL one, so /mnt/c/Users/$USER is not reliable.
  wslconfig=$(powershell.exe -NoProfile -Command \
    'if (Test-Path "$env:UserProfile\.wslconfig") { Get-Content "$env:UserProfile\.wslconfig" -Raw }' \
    2>/dev/null | tr -d '\r')

  # Anchored and whitespace-tolerant: `networkingMode = mirrored` is valid INI
  # that WSL honours, and a commented-out `#networkingMode=mirrored` must not
  # count as enabled.
  if ! echo "$wslconfig" | grep -qiE '^[[:space:]]*networkingMode[[:space:]]*=[[:space:]]*mirrored'; then
    cat <<'EOF'

[detect-host-ip] Mirrored networking is not enabled.
  Two consequences, and the first one means the address above may be wrong:
    - Without it, WSL2 sits on its own NAT, so the address detected here is
      WSL's, not the address guests on your LAN need.
    - Docker Desktop may also only forward ports to 127.0.0.1, not the real
      network adapter, so guests could not reach you even with the right IP.

  To fix it:
    1. Open (or create) %UserProfile%\.wslconfig on Windows.
    2. Add:
         [wsl2]
         networkingMode=mirrored
    3. In PowerShell, run: wsl --shutdown
       (this closes every WSL session, not just this one)
    4. Restart Docker Desktop.
    5. Run this command again.

  Skip this if guests only need localhost, or your network already works
  without it. Otherwise run `ipconfig` on Windows and put that address in
  .env as HOST_LAN_IP by hand.
EOF
  fi
fi
