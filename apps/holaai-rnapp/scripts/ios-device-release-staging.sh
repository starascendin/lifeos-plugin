#!/bin/bash
# scripts/ios-device-release-staging.sh
# Builds iOS release to device using staging environment

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

echo "=== Building iOS Release with STAGING environment ==="
echo "Convex URL: $(grep EXPO_PUBLIC_CONVEX_URL .env.staging | cut -d= -f2)"
echo ""

# Run the build (restore .env regardless of success/failure)
expo run:ios --device --configuration Release
BUILD_EXIT_CODE=$?

# Restore original .env
cp .env.backup .env
rm .env.backup

exit $BUILD_EXIT_CODE
