#!/usr/bin/env bash
# Bring the whole system up, in the order it needs.
#
# Supabase first, because Caddy proxies to it. Both halves are idempotent —
# running this when it's already up just reports that.

set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/lib.sh

frc_require_docker
frc_require_supabase

say "Supabase stack"
supabase start

say "Web server"
frc_compose up -d web

SITE_URL="$(frc_env_get .env VITE_SUPABASE_URL)"
SITE_URL="${SITE_URL:-http://localhost:8080}"

# Give Caddy a moment to bind before deciding whether it worked.
sleep 2
CODE="$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/ 2>/dev/null || echo 000)"

if [ "$CODE" = "200" ]; then
  say "Up — $SITE_URL"

  # Serving the page proves nothing about the database. The browser talks to
  # Supabase directly, so check that path too before declaring success.
  frc_check_api || true

  case "$SITE_URL" in
    http://localhost*) info "Local only. ./scripts/set-public-url.sh to go online." ;;
    *) info "Reachable publicly only while the tunnel is running." ;;
  esac
else
  warn "The app isn't responding yet (HTTP $CODE)."
  info "Give it a few seconds and reload, or look at the log:"
  info "  docker compose logs web"
fi
