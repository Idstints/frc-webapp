#!/usr/bin/env bash
# Shared helpers. Sourced by the other scripts, not run directly.

# ------------------------------------------------------------------ output --

if [ -t 1 ]; then
  _G=$'\033[1;32m'; _Y=$'\033[1;33m'; _R=$'\033[1;31m'; _D=$'\033[2m'; _N=$'\033[0m'
else
  _G=''; _Y=''; _R=''; _D=''; _N=''
fi

say()  { printf '\n%s==>%s %s\n' "$_G" "$_N" "$1"; }
info() { printf '    %s\n' "$1"; }
warn() { printf '%s  ! %s%s\n' "$_Y" "$1" "$_N"; }
die()  { printf '\n%s  x %s%s\n\n' "$_R" "$1" "$_N" >&2; exit 1; }

# ------------------------------------------------------------------- system --

# linux | windows | macos | unsupported
#
# linux   — the real deployment target (Linux Mint on the MacBook)
# windows — supported for testing only, under Git Bash with Docker Desktop
# macos   — kept working in case the MacBook ever goes back to macOS
frc_os() {
  case "$(uname -s)" in
    Linux)                echo linux ;;
    MINGW*|MSYS*|CYGWIN*) echo windows ;;
    Darwin)               echo macos ;;
    *)                    echo unsupported ;;
  esac
}

# Human name for messages: "Linux Mint 22" / "Windows (Git Bash)" / "macOS 15.1"
frc_os_name() {
  case "$(frc_os)" in
    macos)   echo "macOS $(sw_vers -productVersion 2>/dev/null || echo '')" ;;
    windows) echo "Windows — $(uname -s), testing only" ;;
    linux)
      if [ -r /etc/os-release ]; then
        . /etc/os-release
        echo "${PRETTY_NAME:-Linux}"
      else
        echo Linux
      fi ;;
    *) uname -s ;;
  esac
}

# Docker on Linux normally needs either group membership or sudo. Returns the
# prefix callers should put in front of docker commands (usually empty).
frc_docker_prefix() {
  if docker info >/dev/null 2>&1; then
    echo ""
  elif sudo -n docker info >/dev/null 2>&1; then
    echo "sudo"
  else
    echo ""
  fi
}

# ------------------------------------------------------------------- checks --

frc_have() { command -v "$1" >/dev/null 2>&1; }

frc_require_docker() {
  frc_have docker || die "Docker isn't installed.
    Run ./scripts/install-prereqs.sh to install it."

  if ! docker info >/dev/null 2>&1; then
    case "$(frc_os)" in
      macos|windows)
        die "Docker is installed but not running.
    Open Docker Desktop, wait for it to finish starting, then try again." ;;
      *)
        die "Docker is installed but this user can't talk to it.
    Either the service is stopped:   sudo systemctl start docker
    or you're not in the docker group:
        sudo usermod -aG docker \$USER
    then LOG OUT AND BACK IN (group changes need a new session)." ;;
    esac
  fi

  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is missing.
    On Linux:  sudo apt install docker-compose-plugin
    On macOS:  update Docker Desktop, which bundles it.
    Note 'docker-compose' (with a hyphen) is the old v1 and won't work."
}

frc_require_supabase() {
  frc_have supabase || die "The Supabase CLI isn't installed.
    Run ./scripts/install-prereqs.sh to install it."
}

# Run docker compose with the right overlay for this platform. On Linux the
# web container needs host networking to reach the Supabase gateway at all -
# see docker-compose.linux.yml for why.
frc_compose() {
  if [ "$(frc_os)" = linux ]; then
    docker compose -f docker-compose.yml -f docker-compose.linux.yml "$@"
  else
    docker compose -f docker-compose.yml "$@"
  fi
}

# The single most useful check there is: can a browser actually reach the
# database through Caddy? A 502 here means the proxy is up but cannot see the
# Supabase gateway, which is the classic Linux networking failure. Anything
# 2xx/4xx means the request got through to Supabase, which is what we want.
# Prints a verdict and returns non-zero if the API is unreachable.
frc_check_api() {
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:8080/rest/v1/ 2>/dev/null || echo 000)"
  case "$code" in
    502|000)
      warn "The API is NOT reachable through the web server (HTTP $code)."
      info "The site will load and then fail every database call."
      info ""
      info "Almost always this is the web container being unable to see the"
      info "Supabase gateway. Check in this order:"
      info "  1. Is Supabase up?          supabase status"
      info "  2. Is the gateway alive?    curl -I localhost:54321/rest/v1/"
      info "  3. What is the proxy using? docker compose config | grep SUPABASE_UPSTREAM"
      info ""
      info "On Linux the fix is host networking, which the scripts apply from"
      info "docker-compose.linux.yml. If you started the container by hand with"
      info "a plain 'docker compose up', that overlay was skipped - use"
      info "./scripts/start.sh instead."
      return 1 ;;
    *)
      info "API reachable through the web server (HTTP $code)"
      return 0 ;;
  esac
}

# The Supabase CLI names its database container after project_id in config.toml.
frc_db_container() {
  docker ps --filter 'name=supabase_db_' --format '{{.Names}}' 2>/dev/null | head -1
}

# Read a KEY=value from a dotenv file without sourcing it.
frc_env_get() {
  sed -n "s/^$2=//p" "$1" 2>/dev/null | head -1
}
