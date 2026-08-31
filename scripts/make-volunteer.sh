#!/usr/bin/env bash
# Promote an account to an approved repairer.
#
#   ./scripts/make-volunteer.sh someone@example.com
#
# Only needed once. The first approved repairer can approve everyone else from
# inside the app (Repair board > Repairers), which is the way to do it — this
# exists because the very first one has nobody to approve them.
#
# The person must have signed up in the app already.

set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/lib.sh

EMAIL="${1:-}"
[ -n "$EMAIL" ] || die "Usage: ./scripts/make-volunteer.sh someone@example.com"

frc_require_docker
DB="$(frc_db_container)"
[ -n "$DB" ] || die "The database isn't running.
    ./scripts/start.sh"

# Single-quotes doubled, so an apostrophe in an address can't break the query.
ESCAPED="${EMAIL//\'/\'\'}"

SQL="update public.profiles
        set role = 'volunteer', approved = true
      where lower(email) = lower('$ESCAPED')
      returning full_name, email, role, approved;"

say "Promoting $EMAIL"
OUT="$(docker exec -i "$DB" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "$SQL")"
echo "$OUT"

if echo "$OUT" | grep -q "UPDATE 0"; then
  die "No account found for $EMAIL.
    They need to sign up in the app first — this only changes an existing
    account, it doesn't create one."
fi

say "Done"
info "$EMAIL can now see the repair board and approve other repairers."
