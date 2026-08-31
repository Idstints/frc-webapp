#!/usr/bin/env bash
# Shut everything down. Data is kept — this is a stop, not a reset.

set -euo pipefail
cd "$(dirname "$0")/.."

say() { printf '\n\033[1;32m==>\033[0m %s\n' "$1"; }

say "Web server"
docker compose down

say "Supabase stack"
supabase stop

echo
echo "  Stopped. Records are safe in the Docker volume; ./scripts/start.sh brings it back."
echo "  The site is offline until then."
