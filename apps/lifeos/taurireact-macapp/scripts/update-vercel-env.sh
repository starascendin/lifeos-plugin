#!/bin/bash

# Update Environment Variables for a Specific Vercel Environment
# Syncs env vars from a .env file to Preview, Staging, or Production
#
# Environments:
#   preview:    Preview deployments (dev branch)
#   staging:    Staging deployments (staging branch)
#   production: Production deployments (main branch)
#
# Usage:
#   ./scripts/update-vercel-env.sh --target preview --file .env
#   ./scripts/update-vercel-env.sh --target staging --file .env
#   ./scripts/update-vercel-env.sh --target production --file .env
#   ./scripts/update-vercel-env.sh --target preview --file .env --force  # overwrite existing

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"
MONOREPO_ROOT="$(cd "$PACKAGE_DIR/../../.." && pwd)"

# Change to monorepo root where .vercel is located
cd "$MONOREPO_ROOT"

# Defaults
TARGET=""
ENV_FILE=""
FORCE=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --target|-t)
      TARGET="$2"
      shift 2
      ;;
    --file|-f)
      ENV_FILE="$2"
      shift 2
      ;;
    --force|-F)
      FORCE=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 --target <env> --file <path> [OPTIONS]"
      echo ""
      echo "Required:"
      echo "  --target, -t <env>    Target environment: preview, staging, or production"
      echo "  --file, -f <path>     Path to .env file to sync from"
      echo ""
      echo "Options:"
      echo "  --force, -F           Overwrite existing env vars (default: skip existing)"
      echo "  --help, -h            Show this help message"
      echo ""
      echo "Environments:"
      echo "  preview:    Preview deployments (dev branch)"
      echo "  staging:    Staging deployments (staging branch)"
      echo "  production: Production deployments (main branch)"
      echo ""
      echo "Examples:"
      echo "  $0 --target preview --file .env"
      echo "  $0 -t staging -f .env.staging"
      echo "  $0 -t production -f .env.production --force"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Validate required arguments
if [ -z "$TARGET" ]; then
  echo -e "${RED}Error: --target is required (preview, staging, or production)${NC}"
  exit 1
fi

if [ -z "$ENV_FILE" ]; then
  echo -e "${RED}Error: --file is required${NC}"
  exit 1
fi

# Resolve env file path (could be relative to package dir or absolute)
if [[ "$ENV_FILE" != /* ]]; then
  # Relative path - check from package dir first, then current dir
  if [ -f "$PACKAGE_DIR/$ENV_FILE" ]; then
    ENV_FILE="$PACKAGE_DIR/$ENV_FILE"
  elif [ -f "$ENV_FILE" ]; then
    ENV_FILE="$(pwd)/$ENV_FILE"
  fi
fi

if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}Error: File not found: $ENV_FILE${NC}"
  exit 1
fi

# Validate target environment
case $TARGET in
  preview|staging|production)
    ;;
  *)
    echo -e "${RED}Error: Invalid target '$TARGET'. Must be: preview, staging, or production${NC}"
    exit 1
    ;;
esac

echo ""
echo -e "${BLUE}========================================"
echo "  Update Vercel Environment Variables"
echo "========================================${NC}"
echo ""
echo -e "${CYAN}Target:${NC}      $TARGET"
echo -e "${CYAN}Source file:${NC} $ENV_FILE"
if [ "$FORCE" = true ]; then
  echo -e "${CYAN}Mode:${NC}        ${YELLOW}FORCE OVERWRITE${NC}"
else
  echo -e "${CYAN}Mode:${NC}        Add missing only"
fi
echo ""

# Get existing env vars for this environment
echo -e "${BLUE}Fetching existing env vars...${NC}"
EXISTING_VARS=$(npx vercel env list "$TARGET" 2>/dev/null | \
  grep -E "^\s*[A-Z_][A-Z0-9_]*\s+" | \
  awk '{print $1}' || echo "")

# Function to check if var exists
var_exists() {
  local var_name="$1"
  echo "$EXISTING_VARS" | grep -q "^${var_name}$"
}

# Counters
ADDED=0
SKIPPED=0
UPDATED=0
ERRORS=0

echo -e "${BLUE}Processing env vars from $ENV_FILE...${NC}"
echo ""

# Read env file and process each line
while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip empty lines and comments
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

  # Parse KEY=VALUE
  if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
    VAR_NAME="${BASH_REMATCH[1]}"
    VAR_VALUE="${BASH_REMATCH[2]}"

    # Remove surrounding quotes if present
    VAR_VALUE="${VAR_VALUE%\"}"
    VAR_VALUE="${VAR_VALUE#\"}"
    VAR_VALUE="${VAR_VALUE%\'}"
    VAR_VALUE="${VAR_VALUE#\'}"

    # Check if var already exists
    if var_exists "$VAR_NAME"; then
      if [ "$FORCE" = true ]; then
        echo -e "${YELLOW}Updating: $VAR_NAME${NC}"
        if echo "$VAR_VALUE" | npx vercel env add "$VAR_NAME" "$TARGET" --force 2>/dev/null; then
          ((UPDATED++))
        else
          echo -e "${RED}  Failed to update $VAR_NAME${NC}"
          ((ERRORS++))
        fi
      else
        echo -e "${BLUE}Skipping (exists): $VAR_NAME${NC}"
        ((SKIPPED++))
      fi
    else
      echo -e "${GREEN}Adding: $VAR_NAME${NC}"
      if echo "$VAR_VALUE" | npx vercel env add "$VAR_NAME" "$TARGET" 2>/dev/null; then
        ((ADDED++))
      else
        echo -e "${RED}  Failed to add $VAR_NAME${NC}"
        ((ERRORS++))
      fi
    fi
  fi
done < "$ENV_FILE"

echo ""
echo -e "${BLUE}========================================"
echo "  Update Complete!"
echo "========================================${NC}"
echo ""
echo -e "  ${GREEN}Added:${NC}   $ADDED"
if [ "$FORCE" = true ]; then
  echo -e "  ${YELLOW}Updated:${NC} $UPDATED"
fi
echo -e "  ${BLUE}Skipped:${NC} $SKIPPED"
if [ $ERRORS -gt 0 ]; then
  echo -e "  ${RED}Errors:${NC}  $ERRORS"
fi
echo ""
