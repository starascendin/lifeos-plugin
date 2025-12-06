#!/bin/bash
# scripts/env-verify.sh
# Decrypt .age files to .tmpdecrypted for verification (without overwriting actual .env files)
# Usage:
#   pnpm env:verify          # decrypt to temp files
#   pnpm env:verify --clean  # delete temp files

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
AGE_KEY_FILE="$HOME/.age/key.txt"

# Clean mode
if [ "$1" = "--clean" ] || [ "$1" = "-c" ]; then
    echo "=== Cleaning Temp Decrypted Files ==="
    CLEANED=0

    for dir in "$REPO_ROOT"/apps/* "$REPO_ROOT"/packages/*; do
        [ -d "$dir" ] || continue

        for tmp_file in "$dir"/.env*.age.tmpdecrypted; do
            [ -f "$tmp_file" ] || continue
            rm "$tmp_file"
            relative_path="${tmp_file#$REPO_ROOT/}"
            echo "  [DEL] $relative_path"
            ((CLEANED++))
        done
    done

    echo ""
    echo "Cleaned $CLEANED temp file(s)"
    exit 0
fi

# Check if age is installed
if ! command -v age &> /dev/null; then
    echo "Error: 'age' is not installed."
    exit 1
fi

# Verify key exists
if [ ! -f "$AGE_KEY_FILE" ]; then
    echo "Error: Age key not found at $AGE_KEY_FILE"
    echo "Run: pnpm env:setup"
    exit 1
fi

echo "=== Verifying Encrypted Files ==="
echo "Decrypting to .tmpdecrypted files for inspection..."
echo ""

VERIFIED=0
SKIPPED=0
FAILED=0

# Find all .env.age and .env.local.age files in apps/* and packages/*
for dir in "$REPO_ROOT"/apps/* "$REPO_ROOT"/packages/*; do
    [ -d "$dir" ] || continue

    for age_file in "$dir/.env.age" "$dir/.env.local.age"; do
        [ -f "$age_file" ] || continue

        tmp_path="${age_file}.tmpdecrypted"
        relative_age="${age_file#$REPO_ROOT/}"

        if age --decrypt -i "$AGE_KEY_FILE" -o "$tmp_path" "$age_file" 2>/dev/null; then
            echo "  [OK]   ${relative_age}.tmpdecrypted"
            ((VERIFIED++))
        else
            echo "  [FAIL] $relative_age (decryption failed)"
            ((FAILED++))
        fi
    done
done

echo ""
echo "Summary: $VERIFIED verified, $SKIPPED skipped, $FAILED failed"
echo ""
echo "Inspect the .tmpdecrypted files, then clean up with:"
echo "  pnpm env:verify --clean"
