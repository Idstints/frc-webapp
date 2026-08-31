#!/usr/bin/env bash
# Set the web address the site is served at.
#
#   ./scripts/set-public-url.sh                       show how to get an address
#   ./scripts/set-public-url.sh https://x.ts.net      use that address
#   ./scripts/set-public-url.sh --local               go back to localhost
#
# The address lives in two files that must agree, and one of them is compiled
# into the JavaScript. Setting it by hand is the most common way to break
# sign-in, so this does all of it: both files, restart, rebuild.

set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/lib.sh

URL="${1:-}"

# ============================================== no argument: instructions ====

if [ -z "$URL" ]; then
  CURRENT="$(frc_env_get .env VITE_SUPABASE_URL)"
  say "Current address: ${CURRENT:-not set}"

  if [ "$(frc_os)" = macos ]; then
    INSTALL="brew install --cask tailscale"
  else
    INSTALL="curl -fsSL https://tailscale.com/install.sh | sh"
  fi

  cat <<GUIDE

    Right now the site is only reachable from this machine. To let people book
    from home it needs a public address, and that means a tunnel — which gives
    you a real HTTPS address without opening a port on the router or needing a
    fixed IP from your internet provider.

    1. Install Tailscale:

         $INSTALL

    2. Sign in (a browser window opens):

         sudo tailscale up

    3. Publish port 8080 — and only 8080:

         sudo tailscale funnel --bg 8080

       It prints an address like  https://frc-server.tailXXXX.ts.net

    4. Tell the app about it:

         ./scripts/set-public-url.sh https://frc-server.tailXXXX.ts.net

    To check what's currently published:   sudo tailscale funnel status
    To take it offline again:              sudo tailscale funnel --bg off

    ------------------------------------------------------------------------
    Why Tailscale and not Cloudflare: Funnel hands the encrypted traffic to
    this machine and lets it do the decrypting, so visitors' names and phone
    numbers are never readable by anyone in between. Cloudflare Tunnel
    decrypts on their servers. Both work; only one matches the reason we
    stopped using a cloud database.

    A bought domain name is optional and can wait. The free .ts.net address
    works and costs nothing.

GUIDE
  exit 0
fi

# ================================================================== local ====

if [ "$URL" = "--local" ]; then
  URL="http://localhost:8080"
else
  case "$URL" in
    https://*) ;;
    http://localhost*|http://127.0.0.1*)
      warn "Local address — fine for testing, not for real visitors." ;;
    http://*)
      die "Refusing a plain http:// address for a public site.
    Sign-in cookies and visitor details would travel unencrypted." ;;
    *) die "That doesn't look like a URL. Include https://" ;;
  esac
fi
URL="${URL%/}"   # a trailing slash breaks OAuth redirect matching

# =================================================================== apply ===

say "Setting the address to $URL"

[ -f .env ] || die "No .env — run ./scripts/bootstrap.sh first."
[ -f supabase/.env ] || die "No supabase/.env — run ./scripts/bootstrap.sh first."

# sed -i differs between GNU (Linux) and BSD (macOS); write a temp file instead
# so the same code works on both.
set_var() { # file key value
  awk -v k="$2" -v v="$3" 'BEGIN{FS=OFS="="}
    $1==k {print k "=" v; found=1; next}
    {print}
    END{if(!found) print k "=" v}' "$1" > "$1.tmp" && mv "$1.tmp" "$1"
}

set_var .env VITE_SUPABASE_URL "$URL"
set_var supabase/.env FRC_SITE_URL "$URL"

frc_require_docker
frc_require_supabase

say "Restarting the stack so sign-in picks up the new address"
supabase stop
supabase start

./scripts/build.sh

say "Restarting the web server"
frc_compose up -d web

say "The site is now $URL"

cat <<DONE

    Two things this script cannot do for you:

    1. Expose it. Nothing is reachable until the tunnel is running:
         sudo tailscale funnel --bg 8080

    2. Tell Google about it. If Google sign-in is on, add
         $URL/auth/v1/callback
       to the authorised redirect URIs of your OAuth client at
       console.cloud.google.com. Until then Google sign-in fails with
       "redirect_uri_mismatch".

    Anyone signed in before this change will have to sign in again.

DONE
