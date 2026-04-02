#!/usr/bin/env bash
# Install four Finder Quick Actions that call scripts/finder_llm.py (OpenAI-compatible API).
# Re-run after moving the repo. API key: ~/.config/sidekick/openai_api_key or llm.env — see scripts/finder_llm.py
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export REPO_ROOT
RUNNER="${REPO_ROOT}/scripts/finder-llm-run.sh"
DEST_DIR="${HOME}/Library/Services"

if [[ ! -f "$RUNNER" ]] || [[ ! -f "${REPO_ROOT}/scripts/finder_llm.py" ]]; then
  echo "Missing finder-llm-run.sh or finder_llm.py under ${REPO_ROOT}/scripts" >&2
  exit 1
fi
chmod +x "$RUNNER"

/usr/bin/python3 << 'PY'
import os, plistlib, subprocess, uuid
from pathlib import Path

repo = Path(os.environ["REPO_ROOT"])
runner = repo / "scripts" / "finder-llm-run.sh"
dest_dir = Path.home() / "Library" / "Services"

# (menu_title, bundle_id, workflow_filename, LLM_MODE, nssend_utis, input_type_id)
SERVICES = [
    (
        "Summarize with LLM",
        "com.sidekick.llmSummarize",
        "Summarize with LLM.workflow",
        "summarize",
        ["public.text", "public.plain-text", "public.utf8-plain-text", "public.source-code"],
        "com.apple.Automator.text",
    ),
    (
        "Caption image with LLM",
        "com.sidekick.llmCaption",
        "Caption image with LLM.workflow",
        "caption",
        ["public.image"],
        "com.apple.Automator.fileSystemObject.image",
    ),
    (
        "Improve writing with LLM",
        "com.sidekick.llmImprove",
        "Improve writing with LLM.workflow",
        "improve",
        ["public.text", "public.plain-text", "public.utf8-plain-text", "public.source-code"],
        "com.apple.Automator.text",
    ),
    (
        "Commit message from diff",
        "com.sidekick.llmCommit",
        "Commit message from diff.workflow",
        "commit",
        ["public.text", "public.plain-text", "public.utf8-plain-text", "public.source-code"],
        "com.apple.Automator.text",
    ),
]

show_map = "/System/Library/Services/Show Map.workflow/Contents/Resources/document.wflow"
raw = subprocess.check_output(["plutil", "-convert", "xml1", "-o", "-", show_map])
template = plistlib.loads(raw)


def new_uuid() -> str:
    return str(uuid.uuid4()).upper()


for menu_title, bundle_id, wf_name, mode, utis, input_type in SERVICES:
    root = plistlib.loads(plistlib.dumps(template))
    action = root["actions"][0]["action"]
    action["AMAccepts"] = {
        "Container": "List",
        "Optional": False,
        "Types": ["com.apple.cocoa.path"],
    }
    action["InputUUID"] = new_uuid()
    action["OutputUUID"] = new_uuid()
    action["UUID"] = new_uuid()

    cmd = f'''export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export LLM_MODE={mode}
exec "{runner}" "$@"
'''
    action["ActionParameters"]["COMMAND_STRING"] = cmd
    action["ActionParameters"]["inputMethod"] = 1
    action["ActionParameters"]["shell"] = "/bin/bash"
    action["ActionParameters"]["CheckedForUserDefaultShell"] = True

    root["workflowMetaData"] = {
        "serviceApplicationBundleID": "com.apple.finder",
        "serviceApplicationPath": "/System/Library/CoreServices/Finder.app",
        "serviceInputTypeIdentifier": input_type,
        "serviceOutputTypeIdentifier": "com.apple.Automator.nothing",
        "serviceProcessesInput": 0,
        "workflowTypeIdentifier": "com.apple.Automator.servicesMenu",
    }

    root["AMApplicationBuild"] = "500"
    root["AMApplicationVersion"] = "2.10"
    root["AMDocumentVersion"] = "2"

    dest = dest_dir / wf_name
    dest.mkdir(parents=True, exist_ok=True)
    (dest / "Contents" / "Resources").mkdir(parents=True, exist_ok=True)
    (dest / "Contents" / "Resources" / "document.wflow").write_bytes(plistlib.dumps(root))

    info = {
        "CFBundleDevelopmentRegion": "en_US",
        "CFBundleIdentifier": bundle_id,
        "CFBundleName": menu_title,
        "CFBundleShortVersionString": "1.0",
        "NSServices": [
            {
                "NSMenuItem": {"default": menu_title},
                "NSMessage": "runWorkflowAsService",
                "NSRequiredContext": {"NSApplicationIdentifier": "com.apple.finder"},
                "NSSendFileTypes": utis,
            }
        ],
    }
    (dest / "Contents" / "Info.plist").write_bytes(plistlib.dumps(info))
    print("Installed:", dest)

PY

echo ""
echo "API key: create ~/.config/sidekick/openai_api_key (single line) or ~/.config/sidekick/llm.env with:"
echo "  export OPENAI_API_KEY=sk-..."
echo "Optional: LLM_API_BASE (default https://api.openai.com/v1), LLM_MODEL (default gpt-4o-mini)."
echo "Finder → Quick Actions → Summarize / Caption image / Improve writing / Commit message from diff"
