#!/usr/bin/env bash
# Run at login by launchd. Not meant to be called by hand — use start.sh.
#
# Docker Desktop takes a while to be ready after login, and anything that talks
# to it before then fails. So wait for it rather than racing it.

set -uo pipefail
cd "$(dirname "$0")/.."

LOG="${HOME}/Library/Logs/frc-autostart.log"
mkdir -p "$(dirname "$LOG")"
exec >>"$LOG" 2>&1

echo "=== $(date '+%Y-%m-%d %H:%M:%S') autostart ==="

# Docker Desktop can take a couple of minutes on a cold boot.
for i in $(seq 1 60); do
  if docker info >/dev/null 2>&1; then
    echo "Docker ready after ${i}0s"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "Docker never became ready after 10 minutes — giving up."
    exit 1
  fi
  sleep 10
done

# PATH is minimal under launchd; Homebrew lives in different places on Apple
# Silicon and Intel, so cover both.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

./scripts/start.sh
echo "=== started ==="
