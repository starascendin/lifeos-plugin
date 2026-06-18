#!/usr/bin/env bash
set -euo pipefail

#
# npm-safe-publish.sh — Publish to npm without EVER hitting E403 version conflicts.
#
# How it works:
#   1. Queries npm registry for the latest published version
#   2. Takes the HIGHER of local vs npm version as the base
#   3. Bumps patch from that base
#   4. Attempts to publish
#   5. If publish fails with E403 (version exists), increments and retries up to 5 times
#
# Usage:
#   cd packages/lifeos-plugin && bash scripts/npm-safe-publish.sh
#
# Outputs (for CI consumption):
#   Sets PUBLISH_VERSION in $GITHUB_OUTPUT if available
#

MAX_RETRIES=5
PKG_NAME=$(node -p "require('./package.json').name")
LOCAL_VERSION=$(node -p "require('./package.json').version")

echo "==> Package: $PKG_NAME"
echo "==> Local version: $LOCAL_VERSION"

# Get latest version from npm. If package doesn't exist yet, default to 0.0.0.
NPM_VERSION=$(npm view "$PKG_NAME" version 2>/dev/null || echo "0.0.0")
echo "==> npm version: $NPM_VERSION"

# Pick the higher semver of local vs npm
pick_higher() {
  node -e "
    const [a, b] = ['$1', '$2'].map(v => v.split('.').map(Number));
    for (let i = 0; i < 3; i++) {
      if (a[i] > b[i]) { console.log('$1'); process.exit(); }
      if (a[i] < b[i]) { console.log('$2'); process.exit(); }
    }
    console.log('$1');
  "
}

BASE_VERSION=$(pick_higher "$LOCAL_VERSION" "$NPM_VERSION")
echo "==> Base version (higher of local/npm): $BASE_VERSION"

# Bump patch from the base
bump_patch() {
  node -e "
    const parts = '$1'.split('.').map(Number);
    parts[2]++;
    console.log(parts.join('.'));
  "
}

NEXT_VERSION=$(bump_patch "$BASE_VERSION")

# Retry loop: attempt publish, bump if E403
for attempt in $(seq 1 $MAX_RETRIES); do
  echo ""
  echo "==> Attempt $attempt/$MAX_RETRIES: publishing $PKG_NAME@$NEXT_VERSION"

  # Write version into package.json
  npm version "$NEXT_VERSION" --no-git-tag-version --allow-same-version

  # Build
  npm run build

  # Try publish
  if npm publish --access public 2>&1 | tee /tmp/npm-publish-output.txt; then
    echo ""
    echo "==> Successfully published $PKG_NAME@$NEXT_VERSION"

    # Set output for GitHub Actions
    if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
      echo "new_version=$NEXT_VERSION" >> "$GITHUB_OUTPUT"
      echo "current_version=$LOCAL_VERSION" >> "$GITHUB_OUTPUT"
      echo "npm_version=$NPM_VERSION" >> "$GITHUB_OUTPUT"
    fi

    exit 0
  fi

  # Check if it was a version conflict (E403)
  if grep -q "cannot publish over the previously published" /tmp/npm-publish-output.txt 2>/dev/null || \
     grep -q "E403" /tmp/npm-publish-output.txt 2>/dev/null; then
    echo "==> Version $NEXT_VERSION already exists on npm, bumping..."
    NEXT_VERSION=$(bump_patch "$NEXT_VERSION")
  else
    echo "==> Publish failed for a non-version reason. Aborting."
    cat /tmp/npm-publish-output.txt
    exit 1
  fi
done

echo "==> FATAL: Failed to publish after $MAX_RETRIES attempts. Last tried: $NEXT_VERSION"
exit 1
