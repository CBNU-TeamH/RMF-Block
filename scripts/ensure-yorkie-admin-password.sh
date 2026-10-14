#!/usr/bin/env bash
# Gives .env a YORKIE_ADMIN_PASSWORD when it has none, so `pnpm docker:up` never
# meets Compose's refusal to start Yorkie on its default admin/admin (#200). A
# value already there is kept: Yorkie's volume holds the password from the first
# start, and a different one later locks the app out.
set -euo pipefail
cd "$(dirname "$0")/.."

env_file=".env"
touch "$env_file"
if grep -qE '^YORKIE_ADMIN_PASSWORD=.+' "$env_file"; then
  exit 0
fi

# Letters, a digit and a `-` up front: an old volume is moved onto this password
# through Yorkie's ChangePassword, which wants all three in 8-30 characters.
password="rmf1-$(od -An -N12 -tx1 /dev/urandom | tr -d ' \n')"

# The same rewrite as detect-host-ip.sh: drop an empty entry (the sample has
# one), keep everything else, and keep the file's inode and mode.
tmp_file="$env_file.tmp.$$"
trap 'rm -f "$tmp_file"' EXIT
set +e
grep -v '^YORKIE_ADMIN_PASSWORD=' "$env_file" >"$tmp_file"
grep_status=$?
set -e
if (( grep_status > 1 )); then
  echo "[yorkie-admin-password] Could not read $env_file -- set YORKIE_ADMIN_PASSWORD in it by hand."
  exit 0
fi

printf 'YORKIE_ADMIN_PASSWORD=%s\n' "$password" >>"$tmp_file"
cat "$tmp_file" >"$env_file"
echo "[yorkie-admin-password] Generated YORKIE_ADMIN_PASSWORD in .env -- keep it with the volumes."
