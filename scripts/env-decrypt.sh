#!/bin/bash
# scripts/env-decrypt.sh
# Decrypts all .env.age and .env.local.age files in apps/* and packages/*

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
AGE_KEY_FILE="$HOME/.age/key.txt"

# Check if age is installed
if ! command -v age &> /dev/null; then
    echo "Error: 'age' is not installed."
    echo "Install with: brew install age"
    exit 1
fi

# Verify key exists
if [ ! -f "$AGE_KEY_FILE" ]; then
    echo ""
    echo "=========================================="
    echo "ERROR: Age encryption key not found!"
    echo "=========================================="
    echo ""
    echo "Expected location: $AGE_KEY_FILE"
    echo ""
    echo "Options:"
    echo "  1. Generate a new key:  pnpm env:setup"
    echo "  2. Copy existing key from another machine to ~/.age/key.txt"
    echo ""
    exit 1
fi

echo "=== Decrypting Environment Files ==="

DECRYPTED=0
SKIPPED=0
FAILED=0

# Find all .env.age files in apps/*, apps/*/* (nested), and packages/*
for dir in "$REPO_ROOT"/apps/* "$REPO_ROOT"/apps/*/* "$REPO_ROOT"/packages/*; do
    [ -d "$dir" ] || continue

    # Skip if this is the apps/lifeos directory itself (we want its children)
    [[ "$dir" == "$REPO_ROOT/apps/lifeos" ]] && continue

    for encrypted_file in "$dir/.env.age" "$dir/.env.local.age" "$dir/.env.staging.age" "$dir/.env.production.age"; do
        [ -f "$encrypted_file" ] || continue

        # Remove .age extension to get target path
        decrypted_file="${encrypted_file%.age}"
        relative_encrypted="${encrypted_file#$REPO_ROOT/}"
        relative_decrypted="${decrypted_file#$REPO_ROOT/}"

        # Check if decrypted file is newer than encrypted
        if [ -f "$decrypted_file" ] && [ "$decrypted_file" -nt "$encrypted_file" ]; then
            echo "  [SKIP] $relative_decrypted (newer than encrypted)"
            ((SKIPPED++))
            continue
        fi

        if age --decrypt -i "$AGE_KEY_FILE" -o "$decrypted_file" "$encrypted_file" 2>/dev/null; then
            echo "  [OK]   $relative_decrypted"
            ((DECRYPTED++))
        else
            echo "  [FAIL] $relative_decrypted (decryption failed)"
            ((FAILED++))
        fi
    done
done

echo ""
echo "Summary: $DECRYPTED decrypted, $SKIPPED skipped, $FAILED failed"

if [ $FAILED -gt 0 ]; then
    exit 1
fi
