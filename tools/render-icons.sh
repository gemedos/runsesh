#!/usr/bin/env bash
# Renders the PNG app icons from the SVG sources with headless Microsoft Edge (already on Windows).
# No packages needed. Edge has a minimum window size, so sizes below ~500px are rendered
# at 512x512 with a device scale factor (192/512 = 0.375, 180/512 = 0.3515625).
# Usage (Git Bash, from the repo root): bash tools/render-icons.sh
set -euo pipefail
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
ROOT="$(cygpath -m "$(pwd)")"
PROFILE="$(mktemp -d)"
render() { # src out scale
  "$EDGE" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor="$3" \
    --user-data-dir="$(cygpath -m "$PROFILE")/$2" --window-size=512,512 \
    --screenshot="$ROOT/icons/$2" "file:///$ROOT/icons/$1"
}
render icon.svg          icon-512.png          1
render icon-maskable.svg icon-maskable-512.png 1
render icon.svg          icon-192.png          0.375
render icon.svg          apple-touch-icon.png  0.3515625
rm -rf "$PROFILE"
