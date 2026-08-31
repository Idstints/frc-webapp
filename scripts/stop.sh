#!/usr/bin/env bash
# Shut everything down. Data is kept — this is a stop, not a reset.

set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/lib.sh

frc_require_docker

say "Web server"
docker compose down

say "Supabase stack"
supabase stop

say "Stopped"
info "Records are safe in the Docker volume. ./scripts/start.sh brings it back."
info "The site is offline until then."
