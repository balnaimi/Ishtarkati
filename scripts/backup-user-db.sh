#!/usr/bin/env bash
# نسخة طوارئ من قاعدة بيانات المستخدم (قبل أي تجربة إصلاح).
set -euo pipefail
DATA="${XDG_CONFIG_HOME:-$HOME/.config}/ishtarkati"
DB="$DATA/ishtarkati.db"
if [[ ! -f "$DB" ]]; then
  echo "لا توجد قاعدة بيانات في: $DB" >&2
  echo "ابحث يدوياً: find \"\$HOME\" -name ishtarkati.db" >&2
  exit 1
fi
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$HOME/ishtarkati-backup-$STAMP.db"
cp -a "$DB" "$DEST"
for ext in -wal -shm; do
  [[ -f "$DB$ext" ]] && cp -a "$DB$ext" "$DEST$ext"
done
echo "تم الحفظ: $DEST"
