#!/usr/bin/env bash
#
# Build a signed + notarized macOS release of OETools and copy the artifacts
# into "final installs/macos".
#
# Prerequisites (one-time):
#   1. A "Developer ID Application" certificate installed in your login keychain.
#      Check with:  security find-identity -v -p codesigning
#   2. An app-specific password for your Apple ID (https://appleid.apple.com).
#
# Required environment variables (NOT stored in the repo):
#   APPLE_SIGNING_IDENTITY  e.g. "Developer ID Application: Your Name (TEAMID)"
#   APPLE_ID                your Apple ID email
#   APPLE_PASSWORD          the app-specific password (xxxx-xxxx-xxxx-xxxx)
#   APPLE_TEAM_ID           your 10-char team id, e.g. 9285DVDD2K
#
# Usage:
#   APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)" \
#   APPLE_ID="you@example.com" APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx" \
#   APPLE_TEAM_ID="TEAMID" ./scripts/build-macos.sh

set -euo pipefail

: "${APPLE_SIGNING_IDENTITY:?set APPLE_SIGNING_IDENTITY}"
: "${APPLE_ID:?set APPLE_ID}"
: "${APPLE_PASSWORD:?set APPLE_PASSWORD}"
: "${APPLE_TEAM_ID:?set APPLE_TEAM_ID}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Sign the auto-updater artifacts (.app.tar.gz) with the local updater key so the
# in-app updater can verify them. The public key lives in tauri.conf.json.
KEY_FILE="$ROOT/src-tauri/.tauri/oetools_updater.key"
if [ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" ] && [ -f "$KEY_FILE" ]; then
  export TAURI_SIGNING_PRIVATE_KEY="$(cat "$KEY_FILE")"
  export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}"
fi

echo "==> Building (Tauri signs the .app with Developer ID and notarizes it)"
npm run tauri:build

BUNDLE="$(node -e "console.log(require('child_process').execSync('cargo metadata --no-deps --format-version 1',{cwd:'src-tauri'}).toString())" 2>/dev/null \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).target_directory)}catch(e){process.exit(1)}})" 2>/dev/null || true)"
# Fall back to the default target dir if cargo metadata is unavailable.
if [ -z "${BUNDLE:-}" ] || [ ! -d "$BUNDLE" ]; then
  BUNDLE="src-tauri/target"
fi
BUNDLE="$BUNDLE/release/bundle"

DMG="$(ls "$BUNDLE"/dmg/*.dmg 2>/dev/null | head -1)"
APP="$(ls -d "$BUNDLE"/macos/*.app 2>/dev/null | head -1)"

if [ -n "$DMG" ]; then
  echo "==> Notarizing the DMG container"
  xcrun notarytool submit "$DMG" \
    --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_PASSWORD" --wait
  xcrun stapler staple "$DMG"
fi

DEST="$ROOT/final installs/macos"
mkdir -p "$DEST"
[ -n "$DMG" ] && cp "$DMG" "$DEST/"
if [ -n "$APP" ]; then
  ZIP="$DEST/$(basename "${APP%.app}")_macos-app.zip"
  rm -f "$ZIP"
  /usr/bin/ditto -c -k --keepParent "$APP" "$ZIP"
fi

# Copy the signed auto-updater artifacts (.app.tar.gz + .sig) if produced.
for f in "$BUNDLE"/macos/*.app.tar.gz "$BUNDLE"/macos/*.app.tar.gz.sig; do
  [ -e "$f" ] && cp "$f" "$DEST/"
done

echo "==> Verifying Gatekeeper acceptance"
[ -n "$APP" ] && spctl -a -vvv -t exec "$APP" || true

echo "==> Done. Artifacts in: $DEST"
ls -la "$DEST"
