#!/usr/bin/env bash
# Finder hook for selected images (Quick Action / Services). Customize below.
# Install: macos/install-finder-image-automation-service.sh
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH:-}"

notify() {
  local title="$1"
  local msg="$2"
  /usr/bin/osascript -e "display notification \"${msg//\"/\\\"}\" with title \"${title//\"/\\\"}\"" 2>/dev/null || true
}

# Optional: run your own executable instead of the built-in behavior.
# Example: export FINDER_IMAGE_HOOK="$HOME/bin/my-image-pipeline.sh" in the workflow shell step.
if [[ -n "${FINDER_IMAGE_HOOK:-}" && -x "${FINDER_IMAGE_HOOK}" ]]; then
  exec "${FINDER_IMAGE_HOOK}" "$@"
fi

remove_background_one() {
  local input="$1"
  local dir base name
  dir="$(cd "$(dirname "$input")" && pwd)"
  base="$(basename "$input")"
  name="${base%.*}"
  local out="${dir}/${name}-cutout.png"
  rembg i "$input" "$out"
  echo "Wrote $out" >&2
}

main() {
  if [[ $# -lt 1 ]]; then
    echo "Usage: finder-image-automation.sh <image> [more-images…]" >&2
    exit 2
  fi

  if command -v rembg >/dev/null 2>&1; then
    local err=0
    for f in "$@"; do
      [[ -f "$f" ]] || continue
      if ! remove_background_one "$f"; then
        err=1
      fi
    done
    if [[ "$err" -eq 0 ]]; then
      notify "Images" "Background removal finished (rembg)."
    else
      notify "Images" "Some files failed — check Terminal."
    fi
    exit "$err"
  fi

  notify "Images" "Install rembg (pip install rembg) or set FINDER_IMAGE_HOOK. Edit scripts/finder-image-automation.sh."
  echo "rembg not found. pip install rembg  # or set FINDER_IMAGE_HOOK to a custom script" >&2
  exit 127
}

main "$@"
