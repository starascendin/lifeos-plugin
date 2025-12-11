#!/bin/bash
# Sync Convex files from holaaiconvex to holaaiconvex_prod
#
# This script syncs the modular structure from holaaiconvex to holaaiconvex_prod
# preserving subdirectories (holaai/, common/, _lib/)
#
# Usage:
#   pnpm convex:sync-to-prod
#   ./scripts/convex-sync-to-prod.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

SRC="$ROOT_DIR/packages/holaaiconvex/convex"
DEST="$ROOT_DIR/packages/holaaiconvex_prod/convex"

echo "========================================"
echo "  Syncing Convex: holaaiconvex → holaaiconvex_prod"
echo "========================================"
echo ""

# Backup _generated folder (we don't want to overwrite it)
echo "[1/5] Preserving _generated folder..."
if [ -d "$DEST/_generated" ]; then
  mv "$DEST/_generated" "$DEST/_generated.bak"
fi

# Clean destination (except _generated backup)
echo "[2/5] Cleaning destination..."
find "$DEST" -mindepth 1 -maxdepth 1 ! -name '_generated.bak' -exec rm -rf {} +

# Copy all source files (excluding _generated)
echo "[3/5] Copying source files..."
rsync -av --exclude='_generated' "$SRC/" "$DEST/"

# Restore _generated folder
echo "[4/5] Restoring _generated folder..."
if [ -d "$DEST/_generated.bak" ]; then
  mv "$DEST/_generated.bak" "$DEST/_generated"
fi

# Copy seed script if it exists
echo "[5/5] Syncing scripts..."
SRC_SCRIPTS="$ROOT_DIR/packages/holaaiconvex/scripts"
DEST_SCRIPTS="$ROOT_DIR/packages/holaaiconvex_prod/scripts"
if [ -d "$SRC_SCRIPTS" ]; then
  mkdir -p "$DEST_SCRIPTS"
  cp -r "$SRC_SCRIPTS"/* "$DEST_SCRIPTS/"
  chmod +x "$DEST_SCRIPTS"/*.sh 2>/dev/null || true
fi

echo ""
echo "========================================"
echo "  Sync complete!"
echo "========================================"
echo ""
echo "Synced directories:"
echo "  - holaai/     (seed, journey, content, etc.)"
echo "  - common/     (users, tts, messages, etc.)"
echo "  - _lib/       (auth helpers)"
echo "  - Root files  (schema.ts, auth.config.ts, etc.)"
echo ""
echo "Next steps:"
echo "  1. cd packages/holaaiconvex_prod"
echo "  2. npx convex dev --once  (to regenerate _generated)"
echo "  3. npx convex deploy      (to deploy to prod)"
echo "  4. pnpm seed:prod         (to seed the database)"
