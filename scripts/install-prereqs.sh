#!/usr/bin/env bash
# Install the two things this project needs: Docker and the Supabase CLI.
#
#   ./scripts/install-prereqs.sh
#
# Supports Linux Mint / Ubuntu / Debian and macOS. Nothing else is required —
# not Node, not Caddy, not Postgres. Skips anything already present.
#
# This installs system software and will ask for your password.

set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/lib.sh

OS="$(frc_os)"
[ "$OS" != unsupported ] || die "Unsupported system: $(uname -s).
    This runs on Linux (the real target), and on Windows or macOS for testing."

say "Installing prerequisites for $(frc_os_name)"

confirm() {
  printf '\n    %s [y/N] ' "$1"
  read -r reply </dev/tty || reply=n
  case "$reply" in [yY]*) return 0 ;; *) return 1 ;; esac
}

# =========================================================== Linux (apt) =====

install_linux() {
  frc_have apt-get || die "This installer handles apt-based systems (Mint, Ubuntu,
    Debian). For anything else, install Docker Engine, the Docker Compose plugin
    and the Supabase CLI by hand, then run ./scripts/bootstrap.sh"

  # ---- Docker ----
  if frc_have docker && docker compose version >/dev/null 2>&1; then
    info "Docker and Compose already installed"
  else
    say "Installing Docker Engine and the Compose plugin"
    info "Mint's own docker.io package is older and has no Compose v2 plugin,"
    info "so this uses Docker's official repository instead."
    confirm "Add Docker's apt repository and install?" || die "Stopped. Nothing was changed."

    sudo apt-get update -qq
    sudo apt-get install -y -qq ca-certificates curl gnupg

    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
      | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    # Linux Mint's VERSION_CODENAME ("wilma", "xia", ...) means nothing to
    # Docker's repo. Every Mint release maps to an Ubuntu one via
    # UBUNTU_CODENAME, and that is the name the repo actually publishes.
    . /etc/os-release
    CODENAME="${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}"
    [ -n "$CODENAME" ] || die "Couldn't work out which Ubuntu release this is based on.
    Check /etc/os-release for UBUNTU_CODENAME."
    info "Using Ubuntu codename: $CODENAME"

    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $CODENAME stable" \
      | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

    sudo apt-get update -qq
    sudo apt-get install -y -qq \
      docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    sudo systemctl enable --now docker
  fi

  # ---- docker group ----
  if ! docker info >/dev/null 2>&1; then
    if ! id -nG "$USER" | tr ' ' '\n' | grep -qx docker; then
      say "Adding $USER to the docker group"
      sudo usermod -aG docker "$USER"
      NEEDS_RELOGIN=1
    fi
  fi

  # ---- Supabase CLI ----
  if frc_have supabase; then
    info "Supabase CLI already installed ($(supabase --version 2>/dev/null || echo '?'))"
  else
    say "Installing the Supabase CLI"
    case "$(dpkg --print-architecture)" in
      amd64) ARCH=amd64 ;;
      arm64) ARCH=arm64 ;;
      *)     die "Unsupported CPU architecture: $(dpkg --print-architecture)" ;;
    esac
    # The .deb filenames carry a version number, so there is no stable URL for
    # them. The tarball has a version-less "latest" URL, which does not rot.
    TMP="$(mktemp -d)"
    curl -fsSL -o "$TMP/supabase.tar.gz" \
      "https://github.com/supabase/cli/releases/latest/download/supabase_linux_${ARCH}.tar.gz"
    tar -xzf "$TMP/supabase.tar.gz" -C "$TMP" supabase
    sudo install -m 0755 "$TMP/supabase" /usr/local/bin/supabase
    rm -rf "$TMP"
    info "Installed $(supabase --version 2>/dev/null || echo '') to /usr/local/bin/supabase"
  fi
}

# ================================================================= macOS =====

install_macos() {
  if ! frc_have brew; then
    die "Homebrew isn't installed, and it's the sane way to get the rest.
    Install it from https://brew.sh, then run this again."
  fi

  if frc_have docker && docker info >/dev/null 2>&1; then
    info "Docker already installed and running"
  elif frc_have docker; then
    warn "Docker is installed but not running — open Docker Desktop."
  else
    say "Installing Docker Desktop"
    confirm "Install Docker Desktop via Homebrew?" || die "Stopped. Nothing was changed."
    brew install --cask docker
    warn "Open Docker Desktop once so it can finish setting itself up."
    warn "Also turn on: Settings > General > Start Docker Desktop when you sign in"
  fi

  if frc_have supabase; then
    info "Supabase CLI already installed ($(supabase --version 2>/dev/null || echo '?'))"
  else
    say "Installing the Supabase CLI"
    brew install supabase/tap/supabase
  fi
}

# =============================================== Windows (testing only) =====

install_windows() {
  warn "Windows is supported for testing only — the Repair Cafe's server runs Linux Mint."
  echo

  if frc_have docker && docker info >/dev/null 2>&1; then
    info "Docker already installed and running"
  elif frc_have docker; then
    warn "Docker is installed but not running — start Docker Desktop."
  else
    cat <<'DOCKERWIN'
    Docker Desktop has to be installed by hand on Windows, and it needs WSL 2
    underneath it. This is a large install and wants a reboot.

      1. Open PowerShell as Administrator and run:
           wsl --install
         Reboot when it asks.

      2. Install Docker Desktop:
           https://www.docker.com/products/docker-desktop/
         Accept the WSL 2 backend when offered.

      3. Start Docker Desktop and wait for it to say "Engine running".

    Then run this script again.
DOCKERWIN
    return 1
  fi

  if frc_have supabase; then
    info "Supabase CLI already installed ($(supabase --version 2>/dev/null || echo '?'))"
  else
    say "Installing the Supabase CLI"
    if frc_have scoop; then
      scoop bucket add supabase https://github.com/supabase/scoop-bucket.git 2>/dev/null || true
      scoop install supabase
    else
      cat <<'SUPAWIN'
    Install Scoop first (https://scoop.sh), then:
      scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
      scoop install supabase
SUPAWIN
      return 1
    fi
  fi
}

NEEDS_RELOGIN=0
case "$OS" in
  linux)   install_linux ;;
  macos)   install_macos ;;
  windows) install_windows || exit 1 ;;
esac

# ================================================================== done =====

echo
if [ "$NEEDS_RELOGIN" = 1 ]; then
  cat <<'RELOGIN'
  ------------------------------------------------------------------
   You must log out and back in before continuing.

   You were added to the "docker" group, and Linux only applies group
   changes to new login sessions. Until you do, Docker will refuse to
   talk to you and bootstrap will fail.

   After logging back in:   ./scripts/bootstrap.sh
  ------------------------------------------------------------------
RELOGIN
else
  info "Done. Next:  ./scripts/bootstrap.sh"
fi
echo
