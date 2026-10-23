#!/usr/bin/env bash
# Make someone a coordinator, creating their account first if they have none.
#
#   ./scripts/make-coordinator.sh someone@example.com
#   ./scripts/make-coordinator.sh someone@example.com --name "Sam Lee" --password "their-password"
#
# Coordinators can set a new password for any volunteer and make or remove
# other coordinators, all from the Repair team list in the app. This script is
# for when there is nobody to do that: a fresh install, an existing install
# from before coordinators existed, or the last coordinator has left.
#
# If no account exists for the address, one is created and confirmed, and the
# password (generated unless --password is given) is printed once. Use that
# to make a test coordinator, and delete the account when you are done.

set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/lib.sh

EMAIL=""
NAME=""
PASSWORD=""
while [ $# -gt 0 ]; do
  case "$1" in
    --name) NAME="${2:-}"; shift 2 ;;
    --password) PASSWORD="${2:-}"; shift 2 ;;
    -*) die "Unknown option $1" ;;
    *) EMAIL="$1"; shift ;;
  esac
done
[ -n "$EMAIL" ] || die "Usage: ./scripts/make-coordinator.sh someone@example.com [--name \"Full Name\"] [--password \"...\"]"

frc_require_docker
DB="$(frc_db_container)"
[ -n "$DB" ] || die "The database isn't running.
    ./scripts/start.sh"

psql_q() { docker exec -i "$DB" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }

# Single-quotes doubled, so an apostrophe in an address can't break the query.
ESCAPED="${EMAIL//\'/\'\'}"

EXISTS="$(psql_q -tA -c "select count(*) from auth.users where lower(email) = lower('$ESCAPED');")"

CREATED=false
if [ "$EXISTS" = "0" ]; then
  frc_require_supabase
  say "No account for $EMAIL yet. Creating one"

  # Same two ways of asking as bootstrap.sh uses for the anon key.
  SERVICE_KEY="$(supabase status -o env 2>/dev/null | sed -n 's/^SERVICE_ROLE_KEY=//p' | tr -d '"' | head -1)"
  if [ -z "$SERVICE_KEY" ]; then
    SERVICE_KEY="$(supabase status 2>/dev/null | sed -n 's/.*service_role key:[[:space:]]*//p' | head -1)"
  fi
  [ -n "$SERVICE_KEY" ] || die "Couldn't read the service_role key from 'supabase status'."

  if [ -z "$PASSWORD" ]; then
    # Easy to read out: no 0/O, 1/l/i.
    RAW="$(LC_ALL=C tr -dc 'abcdefghjkmnpqrstuvwxyz23456789' </dev/urandom | head -c 12 || true)"
    PASSWORD="${RAW:0:4}-${RAW:4:4}-${RAW:8:4}"
  fi
  [ "${#PASSWORD}" -ge 8 ] || die "The password needs at least 8 characters."
  [ -n "$NAME" ] || NAME="${EMAIL%%@*}"

  # Escape for a JSON string: backslashes first, then double quotes.
  j() { local s="${1//\\/\\\\}"; printf '%s' "${s//\"/\\\"}"; }
  BODY="{\"email\":\"$(j "$EMAIL")\",\"password\":\"$(j "$PASSWORD")\",\"email_confirm\":true,\"user_metadata\":{\"full_name\":\"$(j "$NAME")\",\"role\":\"volunteer\"}}"

  RESP="$(curl -s -w '\n%{http_code}' -X POST http://localhost:54321/auth/v1/admin/users \
    -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
    -H 'Content-Type: application/json' --data "$BODY" || echo $'\n000')"
  CODE="${RESP##*$'\n'}"
  case "$CODE" in
    200|201) CREATED=true ;;
    *) die "Creating the account failed (HTTP $CODE):
    ${RESP%$'\n'*}" ;;
  esac
fi

SQL="update public.profiles
        set role = 'volunteer', approved = true, is_coordinator = true
      where lower(email) = lower('$ESCAPED')
      returning full_name, email, role, approved, is_coordinator;"

say "Making $EMAIL a coordinator"
OUT="$(psql_q -c "$SQL")"
echo "$OUT"

if echo "$OUT" | grep -q "UPDATE 0"; then
  die "The account exists but has no profile row. Sign in once in the app, then run this again."
fi

say "Done"
info "$EMAIL can now approve volunteers, set passwords and choose other coordinators."
if [ "$CREATED" = true ]; then
  info ""
  info "Their password, shown only this once:"
  info "    $PASSWORD"
  info "They can change it after signing in, under My bench."
fi
