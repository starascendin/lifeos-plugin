#!/bin/bash
# Sync Convex files from holaaiconvex to holaaiconvex_prod

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

SRC="$ROOT_DIR/packages/holaaiconvex/convex"
DEST="$ROOT_DIR/packages/holaaiconvex_prod/convex"

echo "Syncing Convex files from holaaiconvex to holaaiconvex_prod..."

# Copy all .ts files (excluding _generated)
cp "$SRC"/*.ts "$DEST/"
cp "$SRC"/tsconfig.json "$DEST/"
cp "$SRC"/README.md "$DEST/"

echo "✓ Synced Convex files to prod"
