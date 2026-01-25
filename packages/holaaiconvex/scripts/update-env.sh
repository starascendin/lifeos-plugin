#!/bin/bash

# Update Environment Variables for a Specific Convex Environment
# Syncs env vars from a .env file to DEV or PROD
#
# Environments:
#   dev:  keen-nightingale-310 (holaconvex-prod dev cloud)
#   prod: agreeable-ibex-949 (holaconvex-prod production cloud)
#
# Usage:
#   ./scripts/update-env.sh --target dev --file .env.aikeys.dev
#   ./scripts/update-env.sh --target prod --file .env.aikeys.dev
#   ./scripts/update-env.sh --target dev --file .env.aikeys.dev --all  # overwrite existing

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PACKAGE_DIR"

# Defaults
TARGET=""
ENV_FILE=""
SYNC_ALL=false

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
    --all|-a)
      SYNC_ALL=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 --target <env> --file <path> [OPTIONS]"
      echo ""
      echo "Required:"
      echo "  --target, -t <env>    Target environment: dev or prod"
      echo "  --file, -f <path>     Path to .env file to sync from"
      echo ""
      echo "Options:"
      echo "  --all, -a             Overwrite ALL env vars (default: only add missing)"
      echo "  --help, -h            Show this help message"
      echo ""
      echo "Environments:"
      echo "  dev:  keen-nightingale-310 (holaconvex-prod dev cloud)"
      echo "  prod: agreeable-ibex-949 (holaconvex-prod production cloud)"
      echo ""
      echo "Examples:"
      echo "  $0 --target dev --file .env.aikeys.dev"
      echo "  $0 -t prod -f .env.aikeys.dev --all"
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
  echo -e "${RED}Error: --target is required (dev or prod)${NC}"
  exit 1
fi

if [ -z "$ENV_FILE" ]; then
  echo -e "${RED}Error: --file is required${NC}"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}Error: File not found: $ENV_FILE${NC}"
  exit 1
fi

# Function to extract CONVEX_URL from env file
get_convex_url() {
  local env_file="$1"
  if [ ! -f "$env_file" ]; then
    echo ""
    return
  fi
  grep -E "^CONVEX_URL=" "$env_file" | cut -d'=' -f2- | tr -d '"' | tr -d "'"
}

# Get project URLs
DEV_PROJECT_URL=$(get_convex_url ".env.local")
PROD_PROJECT_URL=$(get_convex_url ".env.production")

if [ -z "$DEV_PROJECT_URL" ]; then
  echo -e "${RED}Error: Could not find CONVEX_URL in .env.local${NC}"
  exit 1
fi

if [ -z "$PROD_PROJECT_URL" ]; then
  echo -e "${RED}Error: Could not find CONVEX_URL in .env.production${NC}"
  exit 1
fi

# Determine convex command based on target
case $TARGET in
  dev)
    CONVEX_CMD="npx convex env"
    CONVEX_URL="$DEV_PROJECT_URL"
    TARGET_DESC="DEV (keen-nightingale-310)"
    ;;
  prod)
    CONVEX_CMD="npx convex env"
    CONVEX_URL="$PROD_PROJECT_URL"
    TARGET_DESC="PROD (agreeable-ibex-949)"
    ;;
  *)
    echo -e "${RED}Error: Invalid target '$TARGET'. Must be: dev or prod${NC}"
    exit 1
    ;;
esac

echo ""
echo -e "${BLUE}========================================"
echo "  Update Convex Environment Variables"
echo "========================================${NC}"
echo ""
echo -e "${CYAN}Target:${NC}      $TARGET_DESC"
echo -e "${CYAN}Source file:${NC} $ENV_FILE"
if [ "$SYNC_ALL" = true ]; then
  echo -e "${CYAN}Mode:${NC}        ${YELLOW}OVERWRITE ALL${NC}"
else
  echo -e "${CYAN}Mode:${NC}        Add missing only"
fi
echo ""

# Get existing env vars
echo -e "${BLUE}Fetching existing env vars...${NC}"
EXISTING_VARS=$($CONVEX_CMD list --url "$CONVEX_URL" 2>/dev/null | grep -E "^[A-Z_][A-Z0-9_]*=" | cut -d'=' -f1 || echo "")

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
      if [ "$SYNC_ALL" = true ]; then
        echo -e "${YELLOW}Updating: $VAR_NAME${NC}"
        if $CONVEX_CMD set --url "$CONVEX_URL" "$VAR_NAME" "$VAR_VALUE" 2>/dev/null; then
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
      if $CONVEX_CMD set --url "$CONVEX_URL" "$VAR_NAME" "$VAR_VALUE" 2>/dev/null; then
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
if [ "$SYNC_ALL" = true ]; then
  echo -e "  ${YELLOW}Updated:${NC} $UPDATED"
fi
echo -e "  ${BLUE}Skipped:${NC} $SKIPPED"
if [ $ERRORS -gt 0 ]; then
  echo -e "  ${RED}Errors:${NC}  $ERRORS"
fi
echo ""
