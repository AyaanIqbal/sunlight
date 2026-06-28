#!/usr/bin/env bash
# Open the signed .app bundle (correct TCC identity for Ambient Mode).
# Prefer this over `tauri dev` when testing screen capture.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROFILE="${1:-release}"

if [[ "$PROFILE" != "release" && "$PROFILE" != "debug" ]]; then
  echo "Usage: $0 [release|debug]" >&2
  exit 1
fi

APP="$ROOT/src-tauri/target/$PROFILE/bundle/macos/Sunset Lamp Controller.app"

if [[ ! -d "$APP" ]]; then
  echo "App not found. Building ($PROFILE)..."
  if [[ "$PROFILE" == "debug" ]]; then
    (cd "$ROOT" && npm run tauri -- build --debug)
  else
    (cd "$ROOT" && npm run tauri -- build)
  fi
fi

if [[ ! -d "$APP" ]]; then
  echo "Build finished but app not found at:" >&2
  echo "  $APP" >&2
  exit 1
fi

echo "Opening: $APP"
codesign -dv "$APP" 2>&1 | rg "Identifier=" || true
open "$APP"
