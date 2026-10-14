#!/usr/bin/env bash
# Gives .env the two Yorkie secrets Compose refuses to start without (#200), when
# they are missing, so `pnpm docker:up` never runs Yorkie on its built-in
# defaults. A value already there is kept: Yorkie's volume holds the admin
# password from the first start, and a different one later locks the app out.
set -euo pipefail
cd "$(dirname "$0")/.."

env_file=".env"
touch "$env_file"

random_hex() {
  od -An -N"$1" -tx1 /dev/urandom | tr -d ' \n'
}

# $1 = name, $2 = value to use when .env has none.
ensure() {
  if grep -qE "^$1=.+" "$env_file"; then
    return 0
  fi

  # The same rewrite as detect-host-ip.sh: drop an empty entry (the sample has
  # one), keep everything else, and keep the file's inode and mode.
  local tmp_file="$env_file.tmp.$$" grep_status
  set +e
  grep -v "^$1=" "$env_file" >"$tmp_file"
  grep_status=$?
  set -e
  if (( grep_status > 1 )); then
    rm -f "$tmp_file"
    echo "[yorkie-secrets] Could not read $env_file -- set $1 in it by hand."
    return 0
  fi

  printf '%s=%s\n' "$1" "$2" >>"$tmp_file"
  cat "$tmp_file" >"$env_file"
  rm -f "$tmp_file"
  echo "[yorkie-secrets] Generated $1 in .env."
}

# Letters, a digit and a `-` up front: an old volume is moved onto this password
# through Yorkie's ChangePassword, which wants all three in 8-30 characters.
ensure YORKIE_ADMIN_PASSWORD "rmf1-$(random_hex 12)"
# Signs Yorkie's admin tokens. Any long random value; changing it only signs
# everyone out of the Admin API.
ensure YORKIE_ADMIN_TOKEN_SECRET "$(random_hex 32)"
