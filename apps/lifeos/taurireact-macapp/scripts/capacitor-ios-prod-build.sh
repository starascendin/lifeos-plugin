#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

IOS_DIR="$APP_DIR/ios-prod"
WORKSPACE="$IOS_DIR/App/App.xcworkspace"
SCHEME="App"
DERIVED_DATA="$IOS_DIR/build/DerivedData"

if [ ! -d "$IOS_DIR" ]; then
  echo "[cap:ios:prod:build] Missing iOS project at $IOS_DIR"
  echo "[cap:ios:prod:build] Run: pnpm cap:sync:prod"
  exit 1
fi

if [ ! -d "$WORKSPACE" ]; then
  echo "[cap:ios:prod:build] Missing Xcode workspace: $WORKSPACE"
  echo "[cap:ios:prod:build] Run: pnpm cap:sync:prod"
  exit 1
fi

if [ ! -f "$APP_DIR/.env.production" ]; then
  echo "[cap:ios:prod:build] Missing $APP_DIR/.env.production"
  exit 1
fi

echo "[cap:ios:prod:build] Building web assets (Vite production mode) + syncing Capacitor..."
cd "$APP_DIR"
pnpm build:mobile:production

echo "[cap:ios:prod:build] Building iOS (Release)..."
mkdir -p "$IOS_DIR/build"

EXTRA_XCODEBUILD_ARGS=()

# Optional: allow automatic signing updates from CLI if you pass:
#   DEVELOPMENT_TEAM=XXXXXXXXXX pnpm cap:ios:prod:build
if [ -n "${DEVELOPMENT_TEAM:-}" ]; then
  EXTRA_XCODEBUILD_ARGS+=("DEVELOPMENT_TEAM=$DEVELOPMENT_TEAM" "-allowProvisioningUpdates")
fi

xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -derivedDataPath "$DERIVED_DATA" \
  "${EXTRA_XCODEBUILD_ARGS[@]}" \
  build

APP_PATH="$DERIVED_DATA/Build/Products/Release-iphoneos/$SCHEME.app"
if [ ! -d "$APP_PATH" ]; then
  echo "[cap:ios:prod:build] Expected app not found: $APP_PATH"
  echo "[cap:ios:prod:build] Check Xcodebuild output above for signing/build errors."
  exit 1
fi

echo "[cap:ios:prod:build] Built: $APP_PATH"
