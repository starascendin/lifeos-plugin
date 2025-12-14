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

# Function to clean temp files in a directory
clean_temp_files() {
    local dir="$1"
    local cleaned_ref="$2"

    for tmp_file in "$dir"/.env*.age.tmpdecrypted; do
        [ -f "$tmp_file" ] || continue
        rm "$tmp_file"
        relative_path="${tmp_file#$REPO_ROOT/}"
        echo "  [DEL] $relative_path"
        eval "$cleaned_ref=\$((\$$cleaned_ref + 1))"
    done
}

# Clean mode
if [ "$1" = "--clean" ] || [ "$1" = "-c" ]; then
    echo "=== Cleaning Temp Decrypted Files ==="
    CLEANED=0

    # Process apps/ directory (including nested)
    for dir in "$REPO_ROOT"/apps/*; do
        [ -d "$dir" ] || continue
        clean_temp_files "$dir" CLEANED

        for nested_dir in "$dir"/*; do
            [ -d "$nested_dir" ] || continue
            clean_temp_files "$nested_dir" CLEANED
        done
    done

    # Process packages/ directory (including nested)
    for dir in "$REPO_ROOT"/packages/*; do
        [ -d "$dir" ] || continue
        clean_temp_files "$dir" CLEANED

        for nested_dir in "$dir"/*; do
            [ -d "$nested_dir" ] || continue
            clean_temp_files "$nested_dir" CLEANED
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

# Function to verify env.age files in a directory
verify_env_files() {
    local dir="$1"

    # Find all .env*.age files
    for age_file in "$dir"/.env*.age; do
        [ -f "$age_file" ] || continue

        # Skip if it's already a .tmpdecrypted file
        [[ "$age_file" == *.tmpdecrypted ]] && continue

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
}

# Process apps/ directory (including nested like apps/lifeos/*)
for dir in "$REPO_ROOT"/apps/*; do
    [ -d "$dir" ] || continue

    # Check if this directory has .env.age files directly
    verify_env_files "$dir"

    # Check nested directories (e.g., apps/lifeos/taurireact-macapp)
    for nested_dir in "$dir"/*; do
        [ -d "$nested_dir" ] || continue
        verify_env_files "$nested_dir"
    done
done

# Process packages/ directory (including nested)
for dir in "$REPO_ROOT"/packages/*; do
    [ -d "$dir" ] || continue

    # Check if this directory has .env.age files directly
    verify_env_files "$dir"

    # Check nested directories
    for nested_dir in "$dir"/*; do
        [ -d "$nested_dir" ] || continue
        verify_env_files "$nested_dir"
    done
done

echo ""
echo "Summary: $VERIFIED verified, $SKIPPED skipped, $FAILED failed"
echo ""
echo "Inspect the .tmpdecrypted files, then clean up with:"
echo "  pnpm env:verify --clean"
