#!/bin/bash
# scripts/env-encrypt.sh
# Encrypts all .env* files (excluding .age files) in the repository root

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
    echo "Run first: pnpm env:setup"
    echo ""
    exit 1
fi

# Extract public key from private key file
PUBLIC_KEY=$(grep "public key:" "$AGE_KEY_FILE" | sed 's/.*public key: //')

if [ -z "$PUBLIC_KEY" ]; then
    echo "Error: Could not extract public key from $AGE_KEY_FILE"
    exit 1
fi

echo "=== Encrypting Environment Files ==="
echo "Using public key: $PUBLIC_KEY"
echo ""

ENCRYPTED=0
SKIPPED=0
FAILED=0

# Function to encrypt env files in a directory
encrypt_env_files() {
    local dir="$1"

    # Find all .env* files that are NOT .age files and NOT .tmpdecrypted files
    for env_file in "$dir"/.env*; do
        [ -f "$env_file" ] || continue

        # Skip .age files
        [[ "$env_file" == *.age ]] && continue

        # Skip .tmpdecrypted files
        [[ "$env_file" == *.tmpdecrypted ]] && continue

        relative_path="${env_file#$REPO_ROOT/}"
        encrypted_path="${env_file}.age"

        if age --encrypt -r "$PUBLIC_KEY" -o "$encrypted_path" "$env_file" 2>/dev/null; then
            echo "  [OK]   ${relative_path}.age"
            ((ENCRYPTED++))
        else
            echo "  [FAIL] ${relative_path}.age (encryption failed)"
            ((FAILED++))
        fi
    done
}

# Process repository root
encrypt_env_files "$REPO_ROOT"

echo ""
echo "Summary: $ENCRYPTED encrypted, $SKIPPED skipped, $FAILED failed"

if [ $FAILED -gt 0 ]; then
    exit 1
fi

echo ""
echo "Remember to commit the .age files:"
echo "  git add '*.age'"
echo "  git commit -m 'chore: update encrypted env files'"
