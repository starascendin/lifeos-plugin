#!/bin/bash
# scripts/ios-device-release-staging.sh
# Builds iOS release to device using staging environment
# App will be named "LifeOSStaging" to distinguish from production

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

cd "$APP_DIR"

# Check if .env.staging exists
if [ ! -f ".env.staging" ]; then
    echo "Error: .env.staging not found"
    exit 1
fi

# Backup current .env and .env.local
cp .env .env.backup
if [ -f ".env.local" ]; then
    cp .env.local .env.local.backup
    rm .env.local
fi

# Use staging env
cp .env.staging .env

# Change app display name to LifeOSStaging in Info.plist
# This is what actually controls the name shown on iPhone home screen
plutil -replace CFBundleDisplayName -string "LifeOSStaging" ios/LifeOS/Info.plist

echo "=== Building iOS Release with STAGING environment ==="
echo "App Name: LifeOSStaging"
echo "Convex URL: $(grep EXPO_PUBLIC_CONVEX_URL .env.staging | cut -d= -f2)"
echo ""

# Function to restore files
restore_files() {
    cp .env.backup .env
    rm .env.backup
    # Restore .env.local if it was backed up
    if [ -f ".env.local.backup" ]; then
        cp .env.local.backup .env.local
        rm .env.local.backup
    fi
    # Restore default app name
    plutil -replace CFBundleDisplayName -string "LifeOS" ios/LifeOS/Info.plist
}

# Trap to ensure restoration on any exit
trap restore_files EXIT

# Run the build
expo run:ios --device --configuration Release
BUILD_EXIT_CODE=$?

exit $BUILD_EXIT_CODE
