#!/bin/bash
# scripts/env-setup.sh
# First-time setup: generates age key pair

set -e

AGE_KEY_DIR="$HOME/.age"
AGE_KEY_FILE="$AGE_KEY_DIR/key.txt"

echo "=== Age Encryption Setup ==="

# Check if age is installed
if ! command -v age &> /dev/null; then
    echo "Error: 'age' is not installed."
    echo ""
    echo "Install with:"
    echo "  macOS:  brew install age"
    echo "  Linux:  apt install age  OR  brew install age"
    exit 1
fi

# Check if key already exists
if [ -f "$AGE_KEY_FILE" ]; then
    echo "Key already exists at: $AGE_KEY_FILE"
    echo ""
    echo "Your public key:"
    grep "public key:" "$AGE_KEY_FILE" | sed 's/.*public key: //'
    echo ""
    echo "To generate a new key, first remove the existing one:"
    echo "  rm $AGE_KEY_FILE"
    exit 0
fi

# Create directory with secure permissions
mkdir -p "$AGE_KEY_DIR"
chmod 700 "$AGE_KEY_DIR"

# Generate key pair
echo "Generating new age key pair..."
age-keygen -o "$AGE_KEY_FILE" 2>&1

# Set secure permissions on key file
chmod 600 "$AGE_KEY_FILE"

echo ""
echo "Key generated successfully!"
echo "Location: $AGE_KEY_FILE"
echo ""
echo "Your public key (share this with team members):"
grep "public key:" "$AGE_KEY_FILE" | sed 's/.*public key: //'
echo ""
echo "IMPORTANT: Keep your private key secure and backed up!"
echo "The key file should NEVER be committed to git."
