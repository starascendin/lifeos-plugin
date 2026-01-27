#!/bin/bash
# Upload a Capacitor bundle to Cloudflare R2
# Usage: ./scripts/upload-bundle.sh <version>
# Example: ./scripts/upload-bundle.sh 1.0.1

set -e

BUCKET="capacitorfiles"
R2_PUBLIC_URL="https://pub-bf60ae0f93494d11877f2c59d3db71bd.r2.dev"

# Version is required
VERSION=${1:-}
if [ -z "$VERSION" ]; then
  echo "Usage: ./scripts/upload-bundle.sh <version>"
  echo "Example: ./scripts/upload-bundle.sh 1.0.1"
  exit 1
fi

BUNDLE_NAME="bundle-v${VERSION}.zip"

echo "📦 Building app..."
npm run build

echo "🗜️  Creating bundle: ${BUNDLE_NAME}"
cd build
zip -r "../${BUNDLE_NAME}" .
cd ..

echo "☁️  Uploading bundle to R2..."
wrangler r2 object put "${BUCKET}/${BUNDLE_NAME}" --file="${BUNDLE_NAME}" --remote

echo "📝 Updating latest.json manifest..."
cat > /tmp/latest.json << EOF
{
  "version": "${VERSION}",
  "url": "${R2_PUBLIC_URL}/${BUNDLE_NAME}"
}
EOF

wrangler r2 object put "${BUCKET}/latest.json" --file="/tmp/latest.json" --remote --content-type="application/json"

echo "🗑️  Cleaning up local files..."
rm "${BUNDLE_NAME}"
rm /tmp/latest.json

echo ""
echo "✅ Bundle v${VERSION} uploaded successfully!"
echo ""
echo "📍 Bundle URL: ${R2_PUBLIC_URL}/${BUNDLE_NAME}"
echo "📋 Manifest URL: ${R2_PUBLIC_URL}/latest.json"
echo ""
echo "📱 The app will auto-update on next launch, or users can:"
echo "   1. Open Settings → App Updates"
echo "   2. Tap 'Check for Updates'"
echo "   3. Tap 'Install' to apply immediately"
