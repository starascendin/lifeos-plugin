#!/bin/bash
# scripts/ios-device-release.sh
# Builds iOS production release to device
# App will be named "LifeOS"

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

cd "$APP_DIR"

# Ensure app display name is LifeOS in Info.plist
plutil -replace CFBundleDisplayName -string "LifeOS" ios/LifeOS/Info.plist

echo "=== Building iOS Production Release ==="
echo "App Name: LifeOS"
echo ""

# Run the build (release configuration)
expo run:ios --device --configuration Release
