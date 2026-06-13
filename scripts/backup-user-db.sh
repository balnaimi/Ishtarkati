#!/usr/bin/env bash
# Emergency copy of the user database (before risky repair experiments).
set -euo pipefail
DATA="${XDG_CONFIG_HOME:-$HOME/.config}/ishtarkati"
DB="$DATA/ishtarkati.db"
if [[ ! -f "$DB" ]]; then
  echo "No database at: $DB" >&2
  echo "Search manually: find \"\$HOME\" -name ishtarkati.db" >&2
  exit 1
fi
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$HOME/ishtarkati-backup-$STAMP.db"
cp -a "$DB" "$DEST"
for ext in -wal -shm; do
  [[ -f "$DB$ext" ]] && cp -a "$DB$ext" "$DEST$ext"
done
echo "Saved: $DEST"
