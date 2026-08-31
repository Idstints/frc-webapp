#!/usr/bin/env bash
# Promote an account to an approved repairer.
#
#   ./scripts/make-volunteer.sh someone@example.com
#
# Only needed once. The first approved repairer can approve everyone else from
# inside the app (Repair board → Repairers), which is the way to do it — this
# script exists because the very first one has nobody to approve them.
#
# The person must have signed up in the app already.

set -euo pipefail
cd "$(dirname "$0")/.."

die() { printf '\n\033[1;31m✗\033[0m %s\n\n' "$1" >&2; exit 1; }

EMAIL="${1:-}"
[ -n "$EMAIL" ] || die "Usage: ./scripts/make-volunteer.sh someone@example.com"

SQL="update public.profiles
        set role = 'volunteer', approved = true
      where lower(email) = lower('${EMAIL//\'/\'\'}')
      returning full_name, email, role, approved;"

run_sql() {
  if command -v psql >/dev/null 2>&1; then
    psql "postgresql://postgres:postgres@localhost:54322/postgres" -v ON_ERROR_STOP=1 -c "$1"
  else
    # No psql on the Mac — go in through the database container instead.
    local c
    c="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -1)"
    [ -n "$c" ] || die "The database isn't running. ./scripts/start.sh"
    docker exec -i "$c" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "$1"
  fi
}

OUT="$(run_sql "$SQL")"
echo "$OUT"

if echo "$OUT" | grep -q "UPDATE 0"; then
  die "No account found for $EMAIL.
  They need to sign up in the app first — this only changes an existing account."
fi

echo "  Done. $EMAIL can now see the repair board and approve other repairers."
