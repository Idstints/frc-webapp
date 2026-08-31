#!/usr/bin/env bash
# Compile the front end into dist/.
#
# Uses Node from the machine if it's installed (much faster), otherwise builds
# in a container so nobody has to install Node at all.
#
# .env is baked in at this point. That is why every change to it needs a
# rebuild before it has any effect.

set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/lib.sh

[ -f .env ] || die "No .env yet — run ./scripts/bootstrap.sh first."

if frc_have node && frc_have npm; then
  say "Building with local Node $(node -v)"
  [ -d node_modules ] || npm install --no-audit --no-fund
  npm run build
else
  say "No Node installed — building in a container"
  frc_require_docker
  frc_compose --profile build run --rm build
fi

[ -f dist/index.html ] || die "The build produced no dist/index.html. Something failed above."
info "Built $(find dist -type f | wc -l | tr -d ' ') files into dist/"
