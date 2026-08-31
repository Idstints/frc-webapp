#!/usr/bin/env bash
# Compile the front end into dist/.
#
# Uses Node from the Mac if it's installed (much faster), otherwise builds in a
# container so nobody has to install Node at all.
#
# .env is baked in at this point — that is why every change to it needs a
# rebuild before it has any effect.

set -euo pipefail
cd "$(dirname "$0")/.."

say() { printf '\n\033[1;32m==>\033[0m %s\n' "$1"; }

[ -f .env ] || { echo "No .env yet — run ./scripts/bootstrap.sh first." >&2; exit 1; }

if command -v node >/dev/null 2>&1; then
  say "Building with local Node $(node -v)"
  [ -d node_modules ] || npm install --no-audit --no-fund
  npm run build
else
  say "No Node installed — building in a container"
  docker compose --profile build run --rm build
fi

say "Built $(find dist -type f | wc -l | tr -d ' ') files into dist/"
grep -q . <<<"$(ls dist 2>/dev/null)" || { echo "dist/ is empty — build failed." >&2; exit 1; }
