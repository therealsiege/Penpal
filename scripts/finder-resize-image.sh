#!/usr/bin/env bash
# Resize images via macOS sips (longest edge). Finder Quick Action target.
# Env: IMAGE_RESIZE_MAX (default 1920), IMAGE_RESIZE_SUFFIX (default ${MAX}px)
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

MAX="${IMAGE_RESIZE_MAX:-1920}"
SUFFIX="${IMAGE_RESIZE_SUFFIX:-${MAX}px}"

resize_one() {
  local input="$1"
  [[ -f "$input" ]] || return 0
  local dir base name ext out
  dir="$(cd "$(dirname "$input")" && pwd)"
  base="$(basename "$input")"
  if [[ "$base" == *.* ]]; then
    name="${base%.*}"
    ext="${base##*.}"
  else
    name="$base"
    ext=""
  fi
  if [[ -n "$ext" ]]; then
    out="${dir}/${name}-${SUFFIX}.${ext}"
  else
    out="${dir}/${name}-${SUFFIX}"
  fi
  if ! /usr/bin/sips -Z "$MAX" "$input" --out "$out" >/dev/null; then
    echo "sips failed: $input" >&2
    return 1
  fi
  echo "Wrote $out" >&2
}

main() {
  if [[ $# -lt 1 ]]; then
    echo "Usage: finder-resize-image.sh <image> [more…]" >&2
    exit 2
  fi
  local err=0
  for f in "$@"; do
    if ! resize_one "$f"; then
      err=1
    fi
  done
  if [[ "$err" -eq 0 ]]; then
    notify "Resize image" "Done (max edge ${MAX}px)."
  else
    notify "Resize image" "Some files failed — check Terminal."
  fi
  exit "$err"
}

main "$@"
