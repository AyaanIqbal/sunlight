#!/usr/bin/env bash
# Compile Icon Composer (.icon) assets for macOS Liquid Glass icons.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ICON="$ROOT/src-tauri/icons/Sunlight.icon"
OUT="$ROOT/src-tauri/resources"
BUILD_DIR="$(mktemp -d)"
ICON_NAME="Sunlight"
MIN_TARGET="${MACOS_MIN_DEPLOYMENT_TARGET:-14.0}"

cleanup() {
  rm -rf "$BUILD_DIR"
}
trap cleanup EXIT

find_actool() {
  local candidate
  for candidate in \
    "${ACTOOL:-}" \
    "/Applications/Xcode.app/Contents/Developer/usr/bin/actool" \
    "/Applications/Xcode-beta.app/Contents/Developer/usr/bin/actool"
  do
    [[ -n "$candidate" && -x "$candidate" ]] || continue
    if "$candidate" --version >/dev/null 2>&1; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

if [[ ! -d "$ICON" ]]; then
  echo "Icon bundle not found: $ICON" >&2
  exit 1
fi

if ! ATOOL="$(find_actool)"; then
  if [[ -f "$OUT/Assets.car" ]]; then
    echo "actool unavailable; using existing $OUT/Assets.car"
    exit 0
  fi
  echo "actool requires full Xcode (not Command Line Tools alone)." >&2
  echo "Install Xcode, then run: npm run compile:icon" >&2
  exit 1
fi

mkdir -p "$OUT"
PLIST="$BUILD_DIR/assetcatalog_generated_info.plist"

echo "Compiling $ICON with $ATOOL"
"$ATOOL" "$ICON" \
  --compile "$BUILD_DIR" \
  --platform macosx \
  --minimum-deployment-target "$MIN_TARGET" \
  --app-icon "$ICON_NAME" \
  --include-all-app-icons \
  --output-partial-info-plist "$PLIST" \
  --output-format human-readable-text \
  --notices --warnings --errors \
  --enable-on-demand-resources NO

cp "$BUILD_DIR/Assets.car" "$OUT/Assets.car"

if [[ -f "$BUILD_DIR/${ICON_NAME}.icns" ]]; then
  cp "$BUILD_DIR/${ICON_NAME}.icns" "$ROOT/src-tauri/icons/icon.icns"
  echo "Updated legacy fallback: src-tauri/icons/icon.icns"
fi

CONF="$ROOT/src-tauri/tauri.conf.json"
if ! grep -q '"resources/Assets.car"' "$CONF"; then
  node -e "
    const fs = require('fs');
    const path = '$CONF';
    const conf = JSON.parse(fs.readFileSync(path, 'utf8'));
    conf.bundle.resources = ['resources/Assets.car'];
    fs.writeFileSync(path, JSON.stringify(conf, null, 2) + '\n');
  "
  echo "Added resources/Assets.car to tauri.conf.json"
fi

echo "Wrote $OUT/Assets.car"
