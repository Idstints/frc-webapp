#!/usr/bin/env bash
# First-run setup. Safe to run again — it skips anything already done.
#
#   ./scripts/bootstrap.sh
#
# Leaves the whole system running at http://localhost:8080 with an empty
# database. Putting it on the internet is a separate, later step:
#   ./scripts/set-public-url.sh
#
# If Docker or the Supabase CLI are missing, run ./scripts/install-prereqs.sh

set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/lib.sh

say "Checking prerequisites"
info "System: $(frc_os_name)"

[ "$(frc_os)" != unsupported ] || die "Unsupported system: $(uname -s).
    This runs on Linux (the real target), and on Windows or macOS for testing."

if [ "$(frc_os)" = windows ]; then
  warn "Windows is for testing only. The Repair Cafe's server runs Linux Mint,"
  warn "and autostart, backups-on-a-schedule and the tunnel are all Linux there."
fi

frc_require_docker
frc_require_supabase

info "docker    $(docker --version | awk '{print $3}' | tr -d ,)"
info "compose   $(frc_compose version --short 2>/dev/null || echo '?')"
info "supabase  $(supabase --version 2>/dev/null || echo '?')"

# ------------------------------------------------------------ stack env -----

if [ ! -f supabase/.env ]; then
  say "Creating supabase/.env"
  cp supabase/.env.example supabase/.env
  info "Defaults to http://localhost:8080."
  info "Google sign-in stays off until you fill in the two Google values —"
  info "everything else works without it."
else
  say "supabase/.env already exists — leaving it alone"
fi

# --------------------------------------------------------------- stack ------

say "Starting the Supabase stack"
info "First run downloads several GB of images. Go and make a coffee."
supabase start

say "Building the database from supabase/migrations/"
if [ "${FRC_KEEP_DATA:-}" = "1" ]; then
  supabase migration up
  info "Applied new migrations only; existing data kept."
else
  supabase db reset
  info "Database rebuilt from scratch."
  info "Once real bookings exist, use FRC_KEEP_DATA=1 to avoid wiping them."
fi

# ------------------------------------------------------------ front end -----

say "Reading the stack's keys"
ANON_KEY="$(supabase status -o env 2>/dev/null | sed -n 's/^ANON_KEY="\(.*\)"$/\1/p')"
[ -n "$ANON_KEY" ] || die "Couldn't read the anon key from 'supabase status'.
    Run 'supabase status' yourself and copy ANON_KEY into .env by hand."

SITE_URL="$(frc_env_get supabase/.env FRC_SITE_URL)"
SITE_URL="${SITE_URL:-http://localhost:8080}"

say "Writing .env"
cat > .env <<ENVEOF
# Written by scripts/bootstrap.sh.
# These are COMPILED INTO the build — after changing either, run
# ./scripts/build.sh, or use ./scripts/set-public-url.sh which does it for you.
VITE_SUPABASE_URL=$SITE_URL
VITE_SUPABASE_ANON_KEY=$ANON_KEY
ENVEOF
info "Address: $SITE_URL"

./scripts/build.sh

# ----------------------------------------------------------------- web ------

say "Starting the web server"
frc_compose up -d web

sleep 2
say "Checking it actually works"
frc_check_api || warn "Fix the above before going any further — the app cannot work like this."

say "Ready — http://localhost:8080"

cat <<'DONE'

    Next, in order:

    1. Open http://localhost:8080 and create your account.

    2. Make yourself a repairer (the first one has nobody to approve them):
         ./scripts/make-volunteer.sh you@example.com

    3. When you're happy it works, put it on the internet:
         ./scripts/set-public-url.sh          # prints instructions

    4. Have it start by itself after a reboot:
         ./scripts/install-autostart.sh

    Day to day:  ./scripts/start.sh  ./scripts/stop.sh  ./scripts/backup.sh

DONE
