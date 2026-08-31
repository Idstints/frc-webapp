#!/usr/bin/env bash
# Make the site come back by itself after a restart or power cut.
#
#   ./scripts/install-autostart.sh          install
#   ./scripts/install-autostart.sh remove   undo
#
# Installs a launchd agent that waits for Docker, then starts everything.
# Also offers to stop the Mac sleeping, because a sleeping laptop is an
# offline website.

set -euo pipefail
cd "$(dirname "$0")/.."
REPO="$(pwd)"

LABEL="au.org.footscrayrepaircafe.app"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

say() { printf '\n\033[1;32m==>\033[0m %s\n' "$1"; }

if [ "${1:-}" = "remove" ]; then
  launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  say "Removed. The site no longer starts on its own."
  echo "  Sleep settings are unchanged: sudo pmset -a disablesleep 0"
  exit 0
fi

say "Installing the login agent"
mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$REPO/scripts/autostart-run.sh</string>
  </array>
  <key>WorkingDirectory</key><string>$REPO</string>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/frc-autostart.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/frc-autostart.log</string>
</dict>
</plist>
PLISTEOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo "  Installed: $PLIST"
echo "  Log:       ~/Library/Logs/frc-autostart.log"

say "Docker Desktop"
echo "  Set Docker Desktop to open at login as well, or this agent will wait"
echo "  ten minutes and give up:"
echo "    Docker Desktop → Settings → General → Start Docker Desktop when you sign in"

say "Sleep"
cat <<'SLEEP'
  A closed lid or a sleeping Mac takes the website down. While it is plugged
  in and acting as the server:

    sudo pmset -a disablesleep 1

  Undo with:  sudo pmset -a disablesleep 0

  Not run automatically — it changes how the whole Mac behaves, so it should
  be your decision, not a script's.
SLEEP

say "Login agents need the user logged in"
echo "  This starts at login, not at boot. If the Mac restarts and nobody signs"
echo "  in, the site stays down. Enable automatic login for the account that"
echo "  runs this, or expect to log in after every restart."
echo
