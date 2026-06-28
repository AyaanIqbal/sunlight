#!/usr/bin/env bash
# Clear stale Screen Recording TCC rows for this app.
# macOS cannot grant Screen Recording from the command line — after reset,
# launch the app and approve the prompt (or toggle in System Settings).
set -euo pipefail

BUNDLE_ID="com.rawsabsaid.sunlight"

echo "Resetting Screen Recording permission for: $BUNDLE_ID"
tccutil reset ScreenCapture "$BUNDLE_ID" || true

echo ""
echo "Done. Next steps:"
echo "  1. Quit Sunlight if it is running."
echo "  2. Launch the .app bundle (not tauri dev) — see: npm run open:app"
echo "  3. Grant Screen Recording when prompted, then quit and reopen once."
