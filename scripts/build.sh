#!/usr/bin/env bash
# Compile the front end into dist/, then point the running web server at it.
#
# On Linux (the real server) this needs Node 20 or newer on the machine;
# ./scripts/install-prereqs.sh installs it. On Windows and macOS, which are
# for testing only, it falls back to building in a container when Node is
# missing.
#
# Why not the container on Linux too: on the Mint server, build containers
# started and exited without running anything, and the old dist/ made that
# look like a success. Local Node avoids Docker for the build entirely.
#
# .env is baked in at this point. That is why every change to it needs a
# rebuild before it has any effect.

set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/lib.sh

[ -f .env ] || die "No .env yet — run ./scripts/bootstrap.sh first."

OS="$(frc_os)"

# Files left behind by an old container build belong to root, and npm or vite
# then fail halfway with a permissions error. Catch that up front.
for d in node_modules dist; do
  if [ -e "$d" ] && [ ! -w "$d" ]; then
    die "$d/ belongs to another user (left over from a container build),
    so this build can't write to it. Remove it and run this again:
        sudo rm -rf $d"
  fi
done

# Anything older than this file was not produced by this build.
STAMP="$(mktemp)"
trap 'rm -f "$STAMP"' EXIT
sleep 1   # make sure the new files are measurably newer than the stamp

if frc_have node && frc_have npm; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  [ "$NODE_MAJOR" -ge 20 ] || die "Node $(node -v) is too old — the build needs Node 20 or newer.
    Run ./scripts/install-prereqs.sh to install Node 24."

  say "Building with local Node $(node -v)"
  # npm ci, not npm install: it installs exactly what package-lock.json says
  # and never rewrites that file. npm install edits the lock file differently
  # on each system, and that local edit would make the next git pull refuse
  # to run. It also replaces a node_modules folder from another system.
  npm ci --no-audit --no-fund
  npm run build
elif [ "$OS" = linux ]; then
  die "Node isn't installed. The server builds with Node on the machine, not in Docker.
    Run ./scripts/install-prereqs.sh to install Node 24, then run this again."
else
  say "No Node installed — building in a container (testing machines only)"
  frc_require_docker
  frc_compose --profile build run --rm build
fi

# The real check: a new index.html, not just any index.html.
if [ ! -f dist/index.html ] || [ ! dist/index.html -nt "$STAMP" ]; then
  die "The build didn't produce a new dist/index.html, so nothing changed.
    Scroll up for the error. The site is still serving the previous build."
fi
info "Built $(find dist -type f | wc -l | tr -d ' ') files into dist/"

# If the web server is already running, recreate it so it serves the new
# files for certain (a container can keep a replaced dist/ folder open).
if frc_have docker && docker info >/dev/null 2>&1 \
   && [ -n "$(docker ps -q --filter 'name=^frc-web$' 2>/dev/null)" ]; then
  say "Refreshing the web server"
  frc_compose up -d --force-recreate web
fi

say "Build done"
