#!/bin/bash
# scripts/ios-device-release-prod.sh
# Builds iOS release to device using production environment
# App will be named "hola-rnapp PROD" to distinguish from staging/dev

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

cd "$APP_DIR"

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "Error: .env.production not found"
    exit 1
fi

# Backup current .env and .env.local
cp .env .env.backup
if [ -f ".env.local" ]; then
    cp .env.local .env.local.backup
    rm .env.local
fi

# Use production env
cp .env.production .env

# Change app display name to "hola-rnapp PROD" in Info.plist
# This is what actually controls the name shown on iPhone home screen
plutil -replace CFBundleDisplayName -string "hola-rnapp PROD" ios/holarnapp/Info.plist

echo "=== Building iOS Release with PRODUCTION environment ==="
echo "App Name: hola-rnapp PROD"
echo "Convex URL: $(grep EXPO_PUBLIC_CONVEX_URL .env.production | cut -d= -f2)"
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
    plutil -replace CFBundleDisplayName -string "HolaAI" ios/holarnapp/Info.plist
}

# Trap to ensure restoration on any exit
trap restore_files EXIT

# Run the build
expo run:ios --device --configuration Release
BUILD_EXIT_CODE=$?

exit $BUILD_EXIT_CODE
