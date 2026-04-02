#!/usr/bin/env bash
# Convert images to PNG via macOS sips. Writes <name>.png next to the original.
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH:-}"

notify() {
  local title="$1"
  local msg="$2"
  /usr/bin/osascript -e "display notification \"${msg//\"/\\\"}\" with title \"${title//\"/\\\"}\"" 2>/dev/null || true
}

if ! command -v sips >/dev/null 2>&1; then
  echo "sips not found (unexpected on macOS)." >&2
  exit 127
fi

convert_one() {
  local input="$1"
  [[ -f "$input" ]] || return 0
  local dir base name out
  dir="$(cd "$(dirname "$input")" && pwd)"
  base="$(basename "$input")"
  name="${base%.*}"
  out="${dir}/${name}.png"
  if ! /usr/bin/sips -s format png "$input" --out "$out" >/dev/null; then
    echo "sips failed: $input" >&2
    return 1
  fi
  echo "Wrote $out" >&2
}

main() {
  if [[ $# -lt 1 ]]; then
    echo "Usage: finder-convert-to-png.sh <image> [more…]" >&2
    exit 2
  fi
  local err=0
  for f in "$@"; do
    if ! convert_one "$f"; then
      err=1
    fi
  done
  if [[ "$err" -eq 0 ]]; then
    notify "Convert to PNG" "Done."
  else
    notify "Convert to PNG" "Some files failed — check Terminal."
  fi
  exit "$err"
}

main "$@"
