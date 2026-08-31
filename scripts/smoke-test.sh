#!/usr/bin/env bash
# Prove the install actually works, end to end.
#
#   ./scripts/smoke-test.sh
#
# Run it after bootstrap, after any change to the address, and before a cafe
# day. It checks the things that break silently — an API path answering with
# the HTML page, row-level security switched off on a table, the ticket
# endpoint not deployed — rather than the things you would notice anyway.
#
# Exit code is 0 only if every check passes.

set -uo pipefail          # not -e: a failing check must be reported, not fatal
cd "$(dirname "$0")/.."
. scripts/lib.sh

PASS=0; FAIL=0
BASE="http://localhost:8080"

ok()   { printf '  %s✓%s %s\n' "$_G" "$_N" "$1"; PASS=$((PASS+1)); }
no()   { printf '  %sx%s %s\n' "$_R" "$_N" "$1"; [ -n "${2:-}" ] && printf '      %s\n' "$2"; FAIL=$((FAIL+1)); }

frc_require_docker
frc_require_supabase

ANON="$(frc_env_get .env VITE_SUPABASE_ANON_KEY)"
DB="$(frc_db_container)"

# =========================================================== 1. services ====

say "Services"

if supabase status >/dev/null 2>&1; then ok "Supabase stack is running"
else no "Supabase stack is not running" "./scripts/start.sh"; fi

if [ -n "$DB" ]; then ok "Database container: $DB"
else no "No database container found" "./scripts/start.sh"; fi

if frc_compose ps --status running 2>/dev/null | grep -q frc-web; then ok "Web container is running"
else no "Web container is not running" "./scripts/start.sh"; fi

# ================================================================ 2. web ====

say "Web server"

code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$BASE/" || echo 000)"
[ "$code" = 200 ] && ok "Home page responds (200)" || no "Home page returned $code"

if curl -s --max-time 5 "$BASE/ticket" | grep -q '<div id="root">'; then
  ok "Client-side routes fall back to the app (/ticket)"
else
  no "/ticket did not return the app" "try_files is missing from the Caddyfile"
fi

# ================================================================ 3. api ====
# The failure this catches: API paths being served the HTML page instead of
# being proxied. That looks fine in a browser until every database call fails.

say "API paths reach Supabase, not the file server"

for path in /rest/v1/ /auth/v1/settings /storage/v1/bucket /functions/v1/visitor-access; do
  ct="$(curl -s -o /dev/null -w '%{content_type}' --max-time 5 "$BASE$path" || echo none)"
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$BASE$path" || echo 000)"
  case "$ct" in
    text/html*) no "$path was served the HTML page ($code)" \
                   "Caddy is not proxying this path — check the handle blocks" ;;
    *) case "$code" in
         000|502) no "$path unreachable ($code)" "The web container cannot see the Supabase gateway" ;;
         *)       ok "$path proxied (HTTP $code)" ;;
       esac ;;
  esac
done

# ============================================================ 4. postgrest ==

say "Database is answering queries"

if [ -z "$ANON" ]; then
  no "No VITE_SUPABASE_ANON_KEY in .env" "./scripts/bootstrap.sh"
else
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 \
          -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
          "$BASE/rest/v1/cafes?select=name&limit=1" || echo 000)"
  # 200 with [] is correct: RLS hides rows from an anonymous caller.
  case "$code" in
    200) ok "PostgREST answered an authenticated-shaped query (200)" ;;
    401|403) ok "PostgREST answered and enforced access control ($code)" ;;
    *) no "PostgREST returned $code" "Expected 200, 401 or 403" ;;
  esac
fi

# ========================================================= 5. edge function =

say "Ticket endpoint"

code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
        -X POST -H 'Content-Type: application/json' \
        -d '{"action":"__smoke_test__"}' \
        "$BASE/functions/v1/visitor-access" || echo 000)"
case "$code" in
  400|422) ok "visitor-access is deployed and rejecting bad input ($code)" ;;
  404) no "visitor-access is not deployed (404)" "supabase functions serve, or restart the stack" ;;
  401) no "visitor-access demanded a JWT (401)" "verify_jwt must be false in supabase/config.toml" ;;
  000|502) no "visitor-access unreachable ($code)" ;;
  *) ok "visitor-access responded ($code)" ;;
esac

# ============================================================== 6. schema ===

say "Schema"

if [ -n "$DB" ]; then
  q() { docker exec -i "$DB" psql -U postgres -d postgres -tAc "$1" 2>/dev/null | tr -d '\r'; }

  for t in cafes profiles repair_requests volunteer_applications repair_messages ticket_attempts; do
    if [ "$(q "select to_regclass('public.$t') is not null;")" = t ]; then
      ok "table $t"
    else
      no "table $t is missing" "Migrations did not apply — supabase db reset"
    fi
  done

  # The one that matters most: RLS off on any table means that table is world
  # readable through the anon key.
  unprotected="$(q "select string_agg(relname, ', ')
                      from pg_class c join pg_namespace n on n.oid = c.relnamespace
                     where n.nspname = 'public' and c.relkind = 'r'
                       and c.relrowsecurity = false;")"
  if [ -z "$unprotected" ]; then
    ok "Row-level security is on for every public table"
  else
    no "RLS is OFF on: $unprotected" "These tables are readable by anyone with the anon key"
  fi

  for f in is_volunteer assign_job_code find_visitor_match slot_availability set_volunteer_approval; do
    if [ "$(q "select count(*) > 0 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname='public' and p.proname='$f';")" = t ]; then
      ok "function $f"
    else
      no "function $f is missing"
    fi
  done

  if [ "$(q "select count(*) > 0 from storage.buckets where id = 'repair-photos';")" = t ]; then
    ok "storage bucket repair-photos"
  else
    no "storage bucket repair-photos is missing" "Photo uploads will fail"
  fi

  if [ "$(q "select count(*) > 0 from pg_publication_tables where pubname='supabase_realtime' and tablename='repair_messages';")" = t ]; then
    ok "repair_messages is published for realtime"
  else
    no "repair_messages is not in the realtime publication" "Chat will not update live"
  fi
fi

# ============================================================ 7. addresses ==

say "Addresses agree"

FRONT="$(frc_env_get .env VITE_SUPABASE_URL)"
STACK="$(frc_env_get supabase/.env FRC_SITE_URL)"
if [ "$FRONT" = "$STACK" ]; then
  ok "Front end and stack both use $FRONT"
else
  no "Addresses disagree" "front end: $FRONT / stack: $STACK — run ./scripts/set-public-url.sh"
fi

if [ -f dist/index.html ] && grep -rqF "$FRONT" dist/assets/ 2>/dev/null; then
  ok "The built JavaScript contains that address"
else
  no "The build does not contain $FRONT" "The build is stale — ./scripts/build.sh"
fi

# ================================================================ summary ===

echo
if [ "$FAIL" -eq 0 ]; then
  printf '%s  %d checks passed. The install is working.%s\n\n' "$_G" "$PASS" "$_N"
  exit 0
else
  printf '%s  %d passed, %d FAILED.%s\n' "$_R" "$PASS" "$FAIL" "$_N"
  printf '  Do not open this to visitors until the failures above are fixed.\n\n'
  exit 1
fi
