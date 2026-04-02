#!/usr/bin/env bash
# Transcribe media files with OpenAI Whisper CLI. Writes outputs next to each file
# (default: .txt). Use from Terminal or from the Finder "Transcribe with Whisper" service.
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH:-}"

WHISPER_BIN="${WHISPER_BIN:-}"
if [[ -z "$WHISPER_BIN" ]] && command -v whisper >/dev/null 2>&1; then
  WHISPER_BIN="$(command -v whisper)"
fi

notify() {
  local title="$1"
  local msg="$2"
  /usr/bin/osascript -e "display notification \"${msg//\"/\\\"}\" with title \"${title//\"/\\\"}\"" 2>/dev/null || true
}

if [[ -z "${WHISPER_BIN}" ]]; then
  echo "whisper: not found. Install with: pip install -U openai-whisper" >&2
  echo "Put whisper on PATH, or set WHISPER_BIN to the executable." >&2
  notify "Whisper" "whisper CLI not found — see Terminal"
  exit 127
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg: not found (Whisper needs it). Install with: brew install ffmpeg" >&2
  notify "Whisper" "ffmpeg not found — see Terminal"
  exit 127
fi

MODEL="${WHISPER_MODEL:-small}"
OUT_FMT="${WHISPER_OUTPUT_FORMAT:-txt}"

transcribe_one() {
  local input="$1"
  if [[ ! -f "$input" ]]; then
    echo "Skip (not a file): $input" >&2
    return 0
  fi
  local dir
  dir="$(cd "$(dirname "$input")" && pwd)"
  local base
  base="$(basename "$input")"
  echo "Transcribing: $base (model=$MODEL, format=$OUT_FMT)…" >&2
  local -a args=(--model "$MODEL" --output_dir "$dir" --output_format "$OUT_FMT")
  if [[ -n "${WHISPER_LANGUAGE:-}" ]]; then
    args+=(--language "$WHISPER_LANGUAGE")
  fi
  if [[ -n "${WHISPER_DEVICE:-}" ]]; then
    args+=(--device "$WHISPER_DEVICE")
  fi
  "$WHISPER_BIN" "${args[@]}" "$input"
  echo "Done: $base" >&2
}

main() {
  if [[ $# -lt 1 ]]; then
    echo "Usage: whisper-transcribe.sh <media-file> [more-files…]" >&2
    exit 2
  fi
  local err=0
  for f in "$@"; do
    if ! transcribe_one "$f"; then
      err=1
    fi
  done
  if [[ "$err" -eq 0 ]]; then
    notify "Whisper" "Transcript(s) saved next to the file(s)."
  else
    notify "Whisper" "Some files failed — check Terminal."
  fi
  exit "$err"
}

main "$@"
