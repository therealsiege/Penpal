#!/usr/bin/env bash
# Install "Transcribe with Whisper" into ~/Library/Services so it appears in Finder
# (Quick Actions / Services). Re-run after moving the repo.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT_PATH="${REPO_ROOT}/scripts/whisper-transcribe.sh"
SERVICE_NAME="Transcribe with Whisper.workflow"
DEST_DIR="${HOME}/Library/Services"
DEST="${DEST_DIR}/${SERVICE_NAME}"

if [[ ! -f "$SCRIPT_PATH" ]]; then
  echo "Missing ${SCRIPT_PATH}" >&2
  exit 1
fi
chmod +x "$SCRIPT_PATH"

mkdir -p "${DEST}/Contents/Resources"

BUNDLE_ID="com.sidekick.whisperTranscribe"
# Unique per machine/repo path is fine; change if you publish a signed bundle.
MENU_TITLE="Transcribe with Whisper"

export SCRIPT_PATH DEST BUNDLE_ID MENU_TITLE

/usr/bin/python3 << 'PY'
import os, plistlib, subprocess, uuid
from pathlib import Path

script_path = os.environ["SCRIPT_PATH"]
dest = Path(os.environ["DEST"])
bundle_id = os.environ["BUNDLE_ID"]
menu_title = os.environ["MENU_TITLE"]

show_map = "/System/Library/Services/Show Map.workflow/Contents/Resources/document.wflow"
raw = subprocess.check_output(["plutil", "-convert", "xml1", "-o", "-", show_map])
root = plistlib.loads(raw)

def new_uuid() -> str:
    return str(uuid.uuid4()).upper()

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
for f in "$@"; do
  "{script_path}" "$f" || exit $?
done
'''
action["ActionParameters"]["COMMAND_STRING"] = cmd
action["ActionParameters"]["inputMethod"] = 1  # as arguments
action["ActionParameters"]["shell"] = "/bin/bash"
action["ActionParameters"]["CheckedForUserDefaultShell"] = True

root["workflowMetaData"] = {
    "serviceApplicationBundleID": "com.apple.finder",
    "serviceApplicationPath": "/System/Library/CoreServices/Finder.app",
    "serviceInputTypeIdentifier": "com.apple.Automator.fileSystemObject.movie",
    "serviceOutputTypeIdentifier": "com.apple.Automator.nothing",
    "serviceProcessesInput": 0,
    "workflowTypeIdentifier": "com.apple.Automator.servicesMenu",
}

root["AMApplicationBuild"] = "500"
root["AMApplicationVersion"] = "2.10"
root["AMDocumentVersion"] = "2"

dest_plist = dest / "Contents" / "Resources" / "document.wflow"
dest_plist.write_bytes(plistlib.dumps(root))

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
            "NSSendFileTypes": [
                "public.movie",
                "public.audio",
            ],
        }
    ],
}
(dest / "Contents" / "Info.plist").write_bytes(plistlib.dumps(info))
PY

echo "Installed: ${DEST}"
echo "In Finder, right-click a video/audio file → Quick Actions → ${MENU_TITLE}"
echo "(If it does not appear, open System Settings → Privacy & Security → Extensions → Finder, or restart Finder.)"
