#!/bin/bash
# scripts/env-decrypt.sh
# Decrypts all .env*.age files in apps/* and packages/*

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

# Function to decrypt env.age files in a directory
decrypt_env_files() {
    local dir="$1"

    # Find all .env*.age files (but not .tmpdecrypted files)
    for encrypted_file in "$dir"/.env*.age; do
        [ -f "$encrypted_file" ] || continue

        # Skip .tmpdecrypted files
        [[ "$encrypted_file" == *.tmpdecrypted ]] && continue

        # Remove .age extension to get target path
        decrypted_file="${encrypted_file%.age}"
        relative_encrypted="${encrypted_file#$REPO_ROOT/}"
        relative_decrypted="${decrypted_file#$REPO_ROOT/}"

        # Check if decrypted file is newer than encrypted
        if [ -f "$decrypted_file" ] && [ "$decrypted_file" -nt "$encrypted_file" ]; then
            echo "  [SKIP] $relative_decrypted (newer than encrypted)"
            SKIPPED=$((SKIPPED + 1))
            continue
        fi

        if age --decrypt -i "$AGE_KEY_FILE" -o "$decrypted_file" "$encrypted_file" 2>/dev/null; then
            echo "  [OK]   $relative_decrypted"
            DECRYPTED=$((DECRYPTED + 1))
        else
            echo "  [FAIL] $relative_decrypted (decryption failed)"
            FAILED=$((FAILED + 1))
        fi
    done
}

# Process apps/ directory (including nested like apps/lifeos/*)
for dir in "$REPO_ROOT"/apps/*; do
    [ -d "$dir" ] || continue

    # Check if this directory has .env.age files directly
    decrypt_env_files "$dir"

    # Check nested directories (e.g., apps/lifeos/taurireact-macapp)
    for nested_dir in "$dir"/*; do
        [ -d "$nested_dir" ] || continue
        decrypt_env_files "$nested_dir"
    done
done

# Process packages/ directory (including nested)
for dir in "$REPO_ROOT"/packages/*; do
    [ -d "$dir" ] || continue

    # Check if this directory has .env.age files directly
    decrypt_env_files "$dir"

    # Check nested directories
    for nested_dir in "$dir"/*; do
        [ -d "$nested_dir" ] || continue
        decrypt_env_files "$nested_dir"
    done
done

echo ""
echo "Summary: $DECRYPTED decrypted, $SKIPPED skipped, $FAILED failed"

if [ $FAILED -gt 0 ]; then
    exit 1
fi
