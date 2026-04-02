#!/usr/bin/env bash
# Install Finder Quick Action: Resize image (sips, longest edge IMAGE_RESIZE_MAX default 1920).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT_PATH="${REPO_ROOT}/scripts/finder-resize-image.sh"
SERVICE_NAME="Resize image.workflow"
DEST_DIR="${HOME}/Library/Services"
DEST="${DEST_DIR}/${SERVICE_NAME}"

if [[ ! -f "$SCRIPT_PATH" ]]; then
  echo "Missing ${SCRIPT_PATH}" >&2
  exit 1
fi
chmod +x "$SCRIPT_PATH"

mkdir -p "${DEST}/Contents/Resources"

BUNDLE_ID="com.sidekick.finderResizeImage"
MENU_TITLE="Resize image"

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
exec "{script_path}" "$@"
'''
action["ActionParameters"]["COMMAND_STRING"] = cmd
action["ActionParameters"]["inputMethod"] = 1
action["ActionParameters"]["shell"] = "/bin/bash"
action["ActionParameters"]["CheckedForUserDefaultShell"] = True

root["workflowMetaData"] = {
    "serviceApplicationBundleID": "com.apple.finder",
    "serviceApplicationPath": "/System/Library/CoreServices/Finder.app",
    "serviceInputTypeIdentifier": "com.apple.Automator.fileSystemObject.image",
    "serviceOutputTypeIdentifier": "com.apple.Automator.nothing",
    "serviceProcessesInput": 0,
    "workflowTypeIdentifier": "com.apple.Automator.servicesMenu",
}

root["AMApplicationBuild"] = "500"
root["AMApplicationVersion"] = "2.10"
root["AMDocumentVersion"] = "2"

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
            "NSSendFileTypes": ["public.image"],
        }
    ],
}
(dest / "Contents" / "Info.plist").write_bytes(plistlib.dumps(info))
PY

echo "Installed: ${DEST}"
echo "Finder → Quick Actions → ${MENU_TITLE} (default longest edge 1920px; set IMAGE_RESIZE_MAX / IMAGE_RESIZE_SUFFIX to customize)"
echo "Re-run this script after moving the repo."
