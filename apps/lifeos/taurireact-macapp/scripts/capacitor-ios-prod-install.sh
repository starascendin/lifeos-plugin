#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

IOS_DIR="$APP_DIR/ios"
DERIVED_DATA="$IOS_DIR/build/DerivedData"
SCHEME="App"

detect_udid() {
  # Prefer `xctrace` because it's installed with Xcode and works without extra deps.
  local devices
  devices="$(xcrun xctrace list devices 2>/dev/null || true)"
  if [ -z "$devices" ]; then
    return 1
  fi

  # Match physical-device identifiers like:
  #   00008110-0012345678901234
  #   12345678-1234-1234-1234-1234567890AB
  echo "$devices" \
    | rg -v "Simulator" \
    | rg -o "\\(([0-9A-Fa-f-]{16,})\\)" -r '$1' \
    | head -n 1
}

DEVICE_UDID="${IOS_DEVICE_UDID:-${1:-}}"
if [ -z "$DEVICE_UDID" ]; then
  DEVICE_UDID="$(detect_udid || true)"
fi

if [ -z "$DEVICE_UDID" ]; then
  echo "[cap:ios:prod:install] No device UDID provided and none detected."
  echo "[cap:ios:prod:install] Connect your iPhone via USB-C, unlock it, and trust this Mac."
  echo "[cap:ios:prod:install] Then rerun with:"
  echo "  IOS_DEVICE_UDID=<your-udid> pnpm cap:ios:prod:install"
  echo "  pnpm cap:ios:prod:install <your-udid>"
  echo ""
  echo "[cap:ios:prod:install] Available devices (xctrace):"
  xcrun xctrace list devices || true
  exit 1
fi

echo "[cap:ios:prod:install] Using device: $DEVICE_UDID"

cd "$APP_DIR"
pnpm cap:ios:prod:build

APP_PATH="$DERIVED_DATA/Build/Products/Release-iphoneos/$SCHEME.app"
if [ ! -d "$APP_PATH" ]; then
  echo "[cap:ios:prod:install] Built app not found: $APP_PATH"
  exit 1
fi

if xcrun devicectl help >/dev/null 2>&1; then
  echo "[cap:ios:prod:install] Installing to device via devicectl..."
  xcrun devicectl device install app --device "$DEVICE_UDID" "$APP_PATH"
  echo "[cap:ios:prod:install] Installed."
  exit 0
fi

echo "[cap:ios:prod:install] 'xcrun devicectl' not available (older Xcode)."
echo "[cap:ios:prod:install] Open Xcode and run the app on your device instead:"
echo "  pnpm cap:open:ios"
exit 1

