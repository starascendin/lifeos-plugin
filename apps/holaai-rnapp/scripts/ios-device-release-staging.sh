#!/bin/bash
# scripts/ios-device-release-staging.sh
# Builds iOS release to device using staging environment
# App will be named "HolaAIStaging" to distinguish from production

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

cd "$APP_DIR"

# Check if .env.staging exists
if [ ! -f ".env.staging" ]; then
    echo "Error: .env.staging not found"
    exit 1
fi

# Backup current .env
cp .env .env.backup

# Use staging env
cp .env.staging .env

# Change app display name to HolaAIStaging in Info.plist
# This is what actually controls the name shown on iPhone home screen
plutil -replace CFBundleDisplayName -string "HolaAIStaging" ios/holarnapp/Info.plist

echo "=== Building iOS Release with STAGING environment ==="
echo "App Name: HolaAIStaging"
echo "Convex URL: $(grep EXPO_PUBLIC_CONVEX_URL .env.staging | cut -d= -f2)"
echo ""

# Function to restore files
restore_files() {
    cp .env.backup .env
    rm .env.backup
    # Restore default app name
    plutil -replace CFBundleDisplayName -string "HolaAI" ios/holarnapp/Info.plist
}

# Trap to ensure restoration on any exit
trap restore_files EXIT

# Run the build
expo run:ios --device --configuration Release
BUILD_EXIT_CODE=$?

exit $BUILD_EXIT_CODE
