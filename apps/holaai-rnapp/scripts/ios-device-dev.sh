#!/bin/bash
# scripts/ios-device-dev.sh
# Builds iOS dev to device
# App will be named "HolaAIDev" to distinguish from staging/production

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

cd "$APP_DIR"

# Change app display name to HolaAIDev in Info.plist
# This is what actually controls the name shown on iPhone home screen
plutil -replace CFBundleDisplayName -string "HolaAIDev" ios/holarnapp/Info.plist

echo "=== Building iOS Dev ==="
echo "App Name: HolaAIDev"
echo ""

# Function to restore files
restore_files() {
    # Restore default app name
    plutil -replace CFBundleDisplayName -string "HolaAI" ios/holarnapp/Info.plist
}

# Trap to ensure restoration on any exit
trap restore_files EXIT

# Run the build (debug configuration)
expo run:ios --device
BUILD_EXIT_CODE=$?

exit $BUILD_EXIT_CODE
