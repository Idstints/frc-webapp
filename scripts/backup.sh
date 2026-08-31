#!/usr/bin/env bash
# Back up every repair record to a file.
#
#   ./scripts/backup.sh                    → ~/frc-backups
#   ./scripts/backup.sh /Volumes/BackupSSD → somewhere that isn't this laptop
#
# Self-hosting means nobody else is doing this. A single disk failure loses
# every visitor record unless a copy exists off this machine.

set -euo pipefail
cd "$(dirname "$0")/.."

say()  { printf '\n\033[1;32m==>\033[0m %s\n' "$1"; }
die()  { printf '\n\033[1;31m✗\033[0m %s\n\n' "$1" >&2; exit 1; }

DEST="${1:-$HOME/frc-backups}"
KEEP="${FRC_BACKUP_KEEP:-30}"
STAMP="$(date +%Y-%m-%d-%H%M)"
FILE="$DEST/frc-$STAMP.dump"
DB="postgresql://postgres:postgres@localhost:54322/postgres"

mkdir -p "$DEST"

command -v pg_dump >/dev/null 2>&1 || die "pg_dump isn't installed.
  brew install libpq && brew link --force libpq"

supabase status >/dev/null 2>&1 || die "The stack isn't running — nothing to back up.
  ./scripts/start.sh"

say "Dumping to $FILE"
pg_dump "$DB" --format=custom --file="$FILE"

# A dump that can't be listed is a corrupt dump. Cheap to check, so always check.
say "Verifying"
TABLES="$(pg_restore --list "$FILE" | grep -c 'TABLE DATA' || true)"
[ "$TABLES" -gt 0 ] || die "The dump contains no table data. Do not trust it."

SIZE="$(du -h "$FILE" | cut -f1)"
echo "  $TABLES tables, $SIZE"

if [ "$KEEP" -gt 0 ]; then
  say "Removing dumps older than $KEEP days"
  find "$DEST" -name 'frc-*.dump' -type f -mtime "+$KEEP" -print -delete || true
fi

cat <<DONE

  Backed up.  $FILE

  This is only a real backup once a copy lives somewhere other than this Mac.
  And it is only a proven backup once you have restored one:

    createdb frc_restore_test
    pg_restore -d frc_restore_test "$FILE"

DONE
