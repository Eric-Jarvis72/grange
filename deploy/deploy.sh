#!/usr/bin/env bash
# Runs on the deploy host after the release has been synced. Ensures a secret
# key and database path exist, restarts the systemd unit, and waits for the app
# to answer.
set -euo pipefail

ENV_FILE="$HOME/grange.env"
DATA_DIR="$HOME/grange-data"
PORT="${APP_PORT:-3200}"
HOST="${APP_HOST:?APP_HOST must be set to the public hostname}"

if [[ ! "$HOST" =~ ^[a-zA-Z0-9.-]+$ ]]; then
  echo "Invalid APP_HOST: expected a hostname" >&2
  exit 1
fi

if [ ! -s "$ENV_FILE" ]; then
  umask 077
  printf 'SECRET_KEY_BASE=%s\n' "$(openssl rand -base64 48)" > "$ENV_FILE"
fi

# Keep the SQLite database outside the release directory, which rsync replaces
# with --delete on every deploy. Only set it when absent or empty so an explicit
# DATABASE_PATH in ~/grange.env is never overwritten.
mkdir -p "$DATA_DIR"
if ! grep -q '^DATABASE_PATH=.' "$ENV_FILE"; then
  printf 'DATABASE_PATH=%s\n' "$DATA_DIR/grange.sqlite3" >> "$ENV_FILE"
fi

# systemd reads this file on restart. Give each deployment its own public
# origin so Phoenix accepts WebSocket connections from that site's browser.
sed -i '/^PHX_HOST=/d' "$ENV_FILE"
printf 'PHX_HOST=%s\n' "$HOST" >> "$ENV_FILE"

# One-time migration: previous releases kept the database inside the release
# directory (<release>/data/grange.sqlite3). If the new location is still empty
# but the legacy file exists, carry it over so existing data survives the move.
TARGET_DB="$(grep '^DATABASE_PATH=' "$ENV_FILE" | tail -n 1 | cut -d= -f2-)"
RELEASE_DIR="$(cd "$(dirname "$0")" && pwd)"
LEGACY_DB="$RELEASE_DIR/data/grange.sqlite3"
mkdir -p "$(dirname "$TARGET_DB")"
if [ ! -s "$TARGET_DB" ] && [ -s "$LEGACY_DB" ]; then
  cp -n "$LEGACY_DB" "$TARGET_DB"
  for suffix in -wal -shm; do
    if [ -s "$LEGACY_DB$suffix" ]; then
      cp -n "$LEGACY_DB$suffix" "$TARGET_DB$suffix"
    fi
  done
fi

export XDG_RUNTIME_DIR="/run/user/$(id -u)"

systemctl --user restart grange
curl --retry 15 --retry-delay 2 --retry-connrefused -fsS "http://127.0.0.1:${PORT}/api/state"
echo
