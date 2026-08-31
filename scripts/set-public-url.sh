#!/usr/bin/env bash
# Point the whole system at a public address.
#
#   ./scripts/set-public-url.sh https://frc-mac.tailXXXX.ts.net
#
# The address lives in two places that must agree, and one of them is compiled
# into the JavaScript. Getting that wrong is the single most common way to
# break sign-in, so this script does all of it: both files, restart, rebuild.

set -euo pipefail
cd "$(dirname "$0")/.."

say() { printf '\n\033[1;32m==>\033[0m %s\n' "$1"; }
die() { printf '\n\033[1;31m✗\033[0m %s\n\n' "$1" >&2; exit 1; }

URL="${1:-}"
[ -n "$URL" ] || die "Usage: ./scripts/set-public-url.sh https://your-address"

case "$URL" in
  https://*|http://localhost*) ;;
  http://*) die "Refusing to use a plain http:// address for a public site.
  Sign-in cookies and visitor details would travel unencrypted." ;;
  *) die "That doesn't look like a URL. Include https://" ;;
esac
URL="${URL%/}"   # a trailing slash breaks OAuth redirect matching

say "Setting the address to $URL"

# Front end — compiled in at build time.
if grep -q '^VITE_SUPABASE_URL=' .env 2>/dev/null; then
  sed -i.bak "s|^VITE_SUPABASE_URL=.*|VITE_SUPABASE_URL=$URL|" .env && rm -f .env.bak
else
  die "No VITE_SUPABASE_URL in .env — run ./scripts/bootstrap.sh first."
fi

# Stack — read at startup.
if grep -q '^FRC_SITE_URL=' supabase/.env 2>/dev/null; then
  sed -i.bak "s|^FRC_SITE_URL=.*|FRC_SITE_URL=$URL|" supabase/.env && rm -f supabase/.env.bak
else
  die "No FRC_SITE_URL in supabase/.env — run ./scripts/bootstrap.sh first."
fi

say "Restarting the stack so sign-in picks up the new address"
supabase stop
supabase start

./scripts/build.sh

say "Restarting the web server"
docker compose up -d web

cat <<DONE

  The site is now $URL

  Two things this script can't do for you:

  1. Expose it. Nothing is reachable until the tunnel is running:
       sudo tailscale funnel --bg 8080

  2. Tell Google about it. If Google sign-in is on, add
       $URL/auth/v1/callback
     to the authorised redirect URIs of your OAuth client at
     console.cloud.google.com — sign-in fails with a redirect_uri_mismatch
     until you do.

  Anyone signed in before this change will have to sign in again.

DONE
