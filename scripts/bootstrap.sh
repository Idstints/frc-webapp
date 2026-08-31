#!/usr/bin/env bash
# First-run setup. Safe to run again — it skips anything already done.
#
#   ./scripts/bootstrap.sh
#
# Leaves you with the whole system running at http://localhost:8080 and an
# empty database. Making it reachable from the internet is a separate step:
# see scripts/set-public-url.sh.

set -euo pipefail
cd "$(dirname "$0")/.."

say()  { printf '\n\033[1;32m==>\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m !\033[0m %s\n' "$1"; }
die()  { printf '\n\033[1;31m✗\033[0m %s\n\n' "$1" >&2; exit 1; }

# ---------------------------------------------------------------- checks ----

say "Checking what's installed"

command -v docker >/dev/null 2>&1 || die "Docker isn't installed.
  Install Docker Desktop:  brew install --cask docker
  Then open it once so it can finish setting itself up."

docker info >/dev/null 2>&1 || die "Docker is installed but not running.
  Open Docker Desktop and wait for the whale icon to settle, then re-run this."

command -v supabase >/dev/null 2>&1 || die "The Supabase CLI isn't installed.
  Install it:  brew install supabase/tap/supabase"

docker compose version >/dev/null 2>&1 || die "This needs Docker Compose v2.
  It ships with current Docker Desktop — updating Docker should fix it."

echo "  docker    $(docker --version | awk '{print $3}' | tr -d ,)"
echo "  supabase  $(supabase --version 2>/dev/null || echo '?')"

# ------------------------------------------------------------ stack env ----

if [ ! -f supabase/.env ]; then
  say "Creating supabase/.env"
  cp supabase/.env.example supabase/.env
  echo "  Defaults to http://localhost:8080. Google sign-in is off until you"
  echo "  fill in the two Google values — everything else works without it."
else
  say "supabase/.env already exists — leaving it alone"
fi

# --------------------------------------------------------------- stack -----

say "Starting the Supabase stack (first run pulls images — a few minutes)"
supabase start

say "Building the database from supabase/migrations/"
if [ "${FRC_KEEP_DATA:-}" = "1" ]; then
  supabase migration up
  echo "  Applied new migrations only, existing data kept."
else
  supabase db reset
  echo "  Database rebuilt from scratch. (FRC_KEEP_DATA=1 to apply migrations"
  echo "  without wiping — use that once real bookings exist.)"
fi

# ------------------------------------------------------------ front end ----

say "Reading the stack's keys"
ANON_KEY="$(supabase status -o env 2>/dev/null | sed -n 's/^ANON_KEY="\(.*\)"$/\1/p')"
[ -n "$ANON_KEY" ] || die "Couldn't read the anon key from 'supabase status'.
  Run 'supabase status' yourself and copy ANON_KEY into .env by hand."

SITE_URL="$(sed -n 's/^FRC_SITE_URL=//p' supabase/.env | head -1)"
SITE_URL="${SITE_URL:-http://localhost:8080}"

say "Writing .env"
cat > .env <<ENVEOF
# Written by scripts/bootstrap.sh. Compiled into the build — rerun
# scripts/build.sh after any change here, or use scripts/set-public-url.sh.
VITE_SUPABASE_URL=$SITE_URL
VITE_SUPABASE_ANON_KEY=$ANON_KEY
ENVEOF
echo "  URL: $SITE_URL"

./scripts/build.sh

# ----------------------------------------------------------------- web -----

say "Starting the web server"
docker compose up -d web

cat <<DONE

  Ready.  http://localhost:8080

  Next:
    • Create your account in the app, then make yourself a repairer:
        ./scripts/make-volunteer.sh you@example.com
    • Put it on the internet:
        ./scripts/set-public-url.sh https://your-name.tailXXXX.ts.net
    • Start it automatically at login:
        ./scripts/install-autostart.sh

  Day to day:  ./scripts/start.sh   ./scripts/stop.sh   ./scripts/backup.sh

DONE
