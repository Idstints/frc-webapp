#!/usr/bin/env bash
# Run at login by launchd on macOS. Not meant to be called by hand — use
# start.sh. On Linux, systemd calls start.sh directly and this isn't used.
#
# Docker takes a while to be ready after a boot, and anything that talks to it
# before then fails. So wait for it rather than racing it.

set -uo pipefail
cd "$(dirname "$0")/.."

LOG="${HOME}/Library/Logs/frc-autostart.log"
mkdir -p "$(dirname "$LOG")" 2>/dev/null || LOG=/tmp/frc-autostart.log
exec >>"$LOG" 2>&1

echo "=== $(date '+%Y-%m-%d %H:%M:%S') autostart ==="

# launchd gives a minimal PATH, and Homebrew lives in different places on
# Apple Silicon and Intel, so cover both before looking for docker.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

for i in $(seq 1 60); do
  if docker info >/dev/null 2>&1; then
    echo "Docker ready after $((i * 10))s"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "Docker never became ready after 10 minutes — giving up."
    echo "Is Docker Desktop set to start at login?"
    exit 1
  fi
  sleep 10
done

./scripts/start.sh
echo "=== finished ==="
