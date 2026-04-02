#!/usr/bin/env bash
# Wrapper for finder_llm.py — sources API config, then runs the Python entrypoint.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${HOME}/.config/sidekick/llm.env"
KEY_FILE="${HOME}/.config/sidekick/openai_api_key"

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH:-}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck source=/dev/null
  set +u
  source "$ENV_FILE"
  set -u
fi

if [[ -z "${OPENAI_API_KEY:-}" ]] && [[ -z "${LLM_API_KEY:-}" ]] && [[ -f "$KEY_FILE" ]]; then
  export OPENAI_API_KEY="$(/usr/bin/tr -d '\n' <"$KEY_FILE")"
fi

exec /usr/bin/python3 "${REPO_ROOT}/scripts/finder_llm.py" "$@"
