#!/bin/bash
# scripts/env-decrypt.sh
# Decrypts all .env.age files in the monorepo

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

# Define files to decrypt (source .age -> target plaintext)
declare -a ENV_FILES=(
    "apps/hola-rnapp/.env.age:apps/hola-rnapp/.env"
    "apps/hola-rnapp/.env.local.age:apps/hola-rnapp/.env.local"
    "packages/holaaiconvex/.env.local.age:packages/holaaiconvex/.env.local"
    "packages/livekit_agent/.env.local.age:packages/livekit_agent/.env.local"
    "packages/livekit_agent_node/.env.local.age:packages/livekit_agent_node/.env.local"
)

DECRYPTED=0
SKIPPED=0
FAILED=0

for entry in "${ENV_FILES[@]}"; do
    IFS=':' read -r encrypted_file decrypted_file <<< "$entry"
    encrypted_path="$REPO_ROOT/$encrypted_file"
    decrypted_path="$REPO_ROOT/$decrypted_file"

    if [ ! -f "$encrypted_path" ]; then
        echo "  [SKIP] $encrypted_file (not found)"
        ((SKIPPED++))
        continue
    fi

    # Check if decrypted file is newer than encrypted
    if [ -f "$decrypted_path" ] && [ "$decrypted_path" -nt "$encrypted_path" ]; then
        echo "  [SKIP] $decrypted_file (newer than encrypted)"
        ((SKIPPED++))
        continue
    fi

    if age --decrypt -i "$AGE_KEY_FILE" -o "$decrypted_path" "$encrypted_path" 2>/dev/null; then
        echo "  [OK]   $decrypted_file"
        ((DECRYPTED++))
    else
        echo "  [FAIL] $decrypted_file (decryption failed)"
        ((FAILED++))
    fi
done

echo ""
echo "Summary: $DECRYPTED decrypted, $SKIPPED skipped, $FAILED failed"

if [ $FAILED -gt 0 ]; then
    exit 1
fi
