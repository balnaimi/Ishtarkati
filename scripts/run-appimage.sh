#!/usr/bin/env bash
# Run AppImage without libfuse2 (fallback if the bundled build fails on minimal distros).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMG="$(ls -t "$ROOT"/release/Ishtarkati-*.AppImage 2>/dev/null | head -1)"
if [[ -z "${IMG:-}" ]]; then
  echo "No AppImage found under release/" >&2
  exit 1
fi
chmod +x "$IMG"
export APPIMAGE_EXTRACT_AND_RUN=1
exec "$IMG" "$@"
