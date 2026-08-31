#!/usr/bin/env bash
# Back up every repair record to a file.
#
#   ./scripts/backup.sh                     -> ~/frc-backups
#   ./scripts/backup.sh /media/usb/frc      -> somewhere that isn't this laptop
#
# Runs pg_dump inside the database container, so nothing extra needs installing
# and the tool version always matches the server version.
#
# Self-hosting means nobody else is doing this. One disk failure loses every
# visitor record unless a copy exists off this machine.

set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/lib.sh

DEST="${1:-$HOME/frc-backups}"
KEEP="${FRC_BACKUP_KEEP:-30}"
STAMP="$(date +%Y-%m-%d-%H%M)"
FILE="$DEST/frc-$STAMP.dump"

frc_require_docker

DB="$(frc_db_container)"
[ -n "$DB" ] || die "The database isn't running — nothing to back up.
    ./scripts/start.sh"

mkdir -p "$DEST"

say "Dumping from $DB"
# --format=custom so pg_restore can be selective later, and so the dump is
# compressed without depending on anything on the host.
if ! docker exec "$DB" pg_dump -U postgres -d postgres --format=custom > "$FILE"; then
  rm -f "$FILE"
  die "pg_dump failed. Nothing was written."
fi

[ -s "$FILE" ] || { rm -f "$FILE"; die "The dump came out empty. Do not trust it."; }

# A dump that can't be read back is not a backup. Cheap to check, so always check.
say "Verifying"
TABLES="$(docker exec -i "$DB" pg_restore --list < "$FILE" 2>/dev/null | grep -c 'TABLE DATA' || true)"
[ "${TABLES:-0}" -gt 0 ] || die "The dump contains no table data. Do not trust it.
    Kept at $FILE so you can look at it."

SIZE="$(du -h "$FILE" | cut -f1)"
info "$TABLES tables, $SIZE"

if [ "$KEEP" -gt 0 ]; then
  say "Removing dumps older than $KEEP days"
  find "$DEST" -name 'frc-*.dump' -type f -mtime "+$KEEP" -print -delete 2>/dev/null || true
fi

say "Backed up to $FILE"

cat <<DONE

    This is only a real backup once a copy lives somewhere other than this
    machine, and only a proven one once you have restored it. Do that once,
    now, rather than discovering the problem later:

      docker exec -i $DB createdb -U postgres frc_restore_test
      docker exec -i $DB pg_restore -U postgres -d frc_restore_test < "$FILE"
      docker exec -i $DB psql -U postgres -d frc_restore_test -c 'select count(*) from repair_requests;'
      docker exec -i $DB dropdb -U postgres frc_restore_test

DONE
