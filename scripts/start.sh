#!/usr/bin/env bash
# Bring the whole system up, in the order it needs.
#
# Supabase first (Caddy proxies to it), then the web container. Both are
# idempotent — running this when it's already up just reports that.

set -euo pipefail
cd "$(dirname "$0")/.."

say() { printf '\n\033[1;32m==>\033[0m %s\n' "$1"; }

docker info >/dev/null 2>&1 || {
  echo "Docker isn't running. Open Docker Desktop first." >&2; exit 1; }

say "Supabase stack"
supabase start

say "Web server"
docker compose up -d web

SITE_URL="$(sed -n 's/^VITE_SUPABASE_URL=//p' .env 2>/dev/null | head -1)"
say "Up — ${SITE_URL:-http://localhost:8080}"

# A 200 here means Caddy is serving the app; a 000 means it isn't listening yet.
sleep 2
CODE="$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/ || echo 000)"
if [ "$CODE" = "200" ]; then
  echo "  app responding (HTTP 200)"
else
  echo "  app not responding yet (HTTP $CODE) — check: docker compose logs web"
fi
