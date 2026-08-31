#!/usr/bin/env bash
# Make the site come back by itself after a reboot or power cut.
#
#   ./scripts/install-autostart.sh          install
#   ./scripts/install-autostart.sh remove   undo
#
# Linux: a systemd service, which starts at boot whether or not anyone logs in.
# macOS: a launchd agent, which starts at login (macOS has no equivalent that
#        works without a user session, so automatic login matters there).

set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/lib.sh

REPO="$(pwd)"
OS="$(frc_os)"
ACTION="${1:-install}"

[ "$OS" != windows ] || die "There is no autostart for Windows here — it is a
    testing platform, not the server. Start it by hand with ./scripts/start.sh
    On the real server (Linux Mint) this installs a systemd service."

LABEL="au.org.footscrayrepaircafe.app"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
UNIT="/etc/systemd/system/frc-webapp.service"

# ================================================================= remove ====

if [ "$ACTION" = remove ]; then
  if [ "$OS" = macos ]; then
    launchctl unload "$PLIST" 2>/dev/null || true
    rm -f "$PLIST"
  else
    sudo systemctl disable --now frc-webapp.service 2>/dev/null || true
    sudo rm -f "$UNIT"
    sudo systemctl daemon-reload
  fi
  say "Removed — the site no longer starts on its own"
  info "Sleep settings were not changed. See the notes below to undo those."
  exit 0
fi

# ================================================================== linux ====

if [ "$OS" = linux ]; then
  frc_have systemctl || die "This needs systemd, which Mint and Ubuntu both use.
    Your system doesn't appear to have it."

  say "Installing the systemd service"

  sudo tee "$UNIT" >/dev/null <<UNITEOF
[Unit]
Description=Footscray Repair Cafe web app
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
User=$USER
WorkingDirectory=$REPO
Environment="PATH=/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin"
ExecStart=$REPO/scripts/start.sh
ExecStop=$REPO/scripts/stop.sh
# Pulling images on a cold start can take a long while.
TimeoutStartSec=1800

[Install]
WantedBy=multi-user.target
UNITEOF

  sudo systemctl daemon-reload
  sudo systemctl enable frc-webapp.service
  info "Installed: $UNIT"
  info "Starts at boot, with no need for anyone to log in."
  echo
  info "Useful:"
  info "  sudo systemctl status frc-webapp     is it up"
  info "  sudo systemctl restart frc-webapp    restart it"
  info "  journalctl -u frc-webapp -f          watch the log"

  say "Stopping the laptop sleeping"
  cat <<'LINUXSLEEP'
    A suspended laptop is an offline website. Two separate settings:

    1. Closing the lid. Edit /etc/systemd/logind.conf and set:
         HandleLidSwitchExternalPower=ignore
       then:  sudo systemctl restart systemd-logind

    2. Idle suspend. In Mint: Menu > Power Management >
       "Suspend when inactive for" > Never (on AC power).

    Or block suspend outright:
      sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
    Undo with "unmask".

    Not done automatically — it changes how the whole machine behaves, so it
    should be your decision rather than a script's.
LINUXSLEEP

# ================================================================== macos ====

else
  say "Installing the launchd agent"
  mkdir -p "$HOME/Library/LaunchAgents"

  cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$REPO/scripts/autostart-run.sh</string></array>
  <key>WorkingDirectory</key><string>$REPO</string>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/frc-autostart.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/frc-autostart.log</string>
</dict>
</plist>
PLISTEOF

  launchctl unload "$PLIST" 2>/dev/null || true
  launchctl load "$PLIST"
  info "Installed: $PLIST"
  info "Log:       ~/Library/Logs/frc-autostart.log"

  warn "This starts at LOGIN, not at boot."
  info "If the Mac restarts and nobody signs in, the site stays down. Turn on"
  info "automatic login for this account, or expect to log in after a restart."
  info "Also enable: Docker Desktop > Settings > General > Start when you sign in"

  say "Stopping the Mac sleeping"
  cat <<'MACSLEEP'
    While it is plugged in and acting as the server:
      sudo pmset -a disablesleep 1
    Undo with:
      sudo pmset -a disablesleep 0

    Not done automatically — it changes how the whole machine behaves.
MACSLEEP
fi

echo
