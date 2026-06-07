#!/usr/bin/env bash
# تشغيل AppImage بدون libfuse2 (احتياطي إن فشل النسخة الجديدة المدمجة).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMG="$(ls -t "$ROOT"/release/Ishtarkati-*.AppImage 2>/dev/null | head -1)"
if [[ -z "${IMG:-}" ]]; then
  echo "لم يُعثر على AppImage تحت release/" >&2
  exit 1
fi
chmod +x "$IMG"
export APPIMAGE_EXTRACT_AND_RUN=1
exec "$IMG" "$@"
