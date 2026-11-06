#!/usr/bin/env bash
# Renders the AMO store screenshots (1280x800 PNG) from the mock pages in this
# folder with headless Chromium. The mocks use the add-on's real CSS with
# made-up songs, so the screenshots show the real design and no real data.
#
# Usage: store/screenshots/render.sh [path-to-chrome-headless-shell]
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
chrome="${1:-chrome-headless-shell}"

# Renders one variant of window.html to <name>.png. Extra arguments go to
# Chromium (e.g. --blink-settings=preferredColorScheme=0 for prefers-color-scheme: dark).
render() {
  local shot="$1" name="$2"
  shift 2
  "$chrome" --headless --no-sandbox --disable-gpu --hide-scrollbars "$@" \
    --allow-file-access-from-files --virtual-time-budget=2000 \
    --window-size=1280,800 --screenshot="$here/$name.png" \
    "file://$here/window.html?shot=$shot"
}

render queue 1-queue
render playlist 2-playlist
render popup 3-popup
render queue 4-queue-dark --blink-settings=preferredColorScheme=0
