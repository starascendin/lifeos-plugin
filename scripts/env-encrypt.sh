#!/bin/bash
# scripts/env-encrypt.sh
# Encrypts all .env files in the monorepo

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

# Define files to encrypt (source plaintext -> target .age)
declare -a ENV_FILES=(
    "apps/hola-rnapp/.env:apps/hola-rnapp/.env.age"
    "apps/hola-rnapp/.env.local:apps/hola-rnapp/.env.local.age"
    "packages/holaaiconvex/.env.local:packages/holaaiconvex/.env.local.age"
    "packages/livekit_agent/.env.local:packages/livekit_agent/.env.local.age"
    "packages/livekit_agent_node/.env.local:packages/livekit_agent_node/.env.local.age"
)

ENCRYPTED=0
SKIPPED=0
FAILED=0

for entry in "${ENV_FILES[@]}"; do
    IFS=':' read -r plaintext_file encrypted_file <<< "$entry"
    plaintext_path="$REPO_ROOT/$plaintext_file"
    encrypted_path="$REPO_ROOT/$encrypted_file"

    if [ ! -f "$plaintext_path" ]; then
        echo "  [SKIP] $plaintext_file (not found)"
        ((SKIPPED++))
        continue
    fi

    if age --encrypt -r "$PUBLIC_KEY" -o "$encrypted_path" "$plaintext_path" 2>/dev/null; then
        echo "  [OK]   $encrypted_file"
        ((ENCRYPTED++))
    else
        echo "  [FAIL] $encrypted_file (encryption failed)"
        ((FAILED++))
    fi
done

echo ""
echo "Summary: $ENCRYPTED encrypted, $SKIPPED skipped, $FAILED failed"

if [ $FAILED -gt 0 ]; then
    exit 1
fi

echo ""
echo "Remember to commit the .age files:"
echo "  git add '*.age'"
echo "  git commit -m 'chore: update encrypted env files'"
