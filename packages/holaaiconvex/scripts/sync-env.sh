#!/bin/bash

# Sync Environment Variables to Convex
# This script reads .env.aikeys.dev and syncs env vars to Convex cloud
#
# Usage:
#   ./scripts/sync-env.sh                    # Sync missing vars to dev
#   ./scripts/sync-env.sh --prod             # Sync missing vars to production
#   ./scripts/sync-env.sh --all              # Sync ALL vars to dev (overwrite)
#   ./scripts/sync-env.sh --all --prod       # Sync ALL vars to production (overwrite)
#   ./scripts/sync-env.sh --list             # List current env vars in dev
#   ./scripts/sync-env.sh --list --prod      # List current env vars in production
#   ./scripts/sync-env.sh --env-file <path>  # Use custom env file

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PACKAGE_DIR"

# Defaults
TARGET=""  # Empty = dev, --prod = production
SYNC_ALL=false
LIST_ONLY=false
ENV_FILE=".env.aikeys.dev"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --prod)
      TARGET="--prod"
      shift
      ;;
    --all)
      SYNC_ALL=true
      shift
      ;;
    --list)
      LIST_ONLY=true
      shift
      ;;
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --prod                Sync to production environment"
      echo "  --all                 Sync ALL env vars (overwrite existing)"
      echo "  --list                List current env vars (don't sync)"
      echo "  --env-file <path>     Use custom env file (default: .env.aikeys.dev)"
      echo "  --help, -h            Show this help message"
      echo ""
      echo "By default, syncs only MISSING env vars to development"
      echo ""
      echo "Examples:"
      echo "  $0                    # Sync missing vars to dev"
      echo "  $0 --prod             # Sync missing vars to production"
      echo "  $0 --all              # Overwrite all vars in dev"
      echo "  $0 --all --prod       # Overwrite all vars in production"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Determine target name for display
if [ -z "$TARGET" ]; then
  TARGET_NAME="development"
else
  TARGET_NAME="production"
fi

echo ""
echo -e "${BLUE}========================================"
echo "  Convex Environment Variables Sync"
echo "  Target: $TARGET_NAME"
if [ "$SYNC_ALL" = true ]; then
  echo -e "  Mode: ${YELLOW}SYNC ALL (overwrite)${BLUE}"
else
  echo "  Mode: Sync missing only"
fi
echo "========================================${NC}"
echo ""

# Function to list current env vars
list_env_vars() {
  echo -e "${BLUE}Current environment variables in $TARGET_NAME:${NC}"
  echo ""
  npx convex env list $TARGET 2>/dev/null || echo "No environment variables set"
  echo ""
}

# If list only mode, just show vars and exit
if [ "$LIST_ONLY" = true ]; then
  list_env_vars
  exit 0
fi

# Check if env file exists
if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}Error: Environment file not found: $ENV_FILE${NC}"
  exit 1
fi

echo -e "${BLUE}Reading env vars from: $ENV_FILE${NC}"
echo ""

# Get existing env vars from Convex
echo -e "${BLUE}Fetching existing env vars from Convex...${NC}"
EXISTING_VARS=$(npx convex env list $TARGET 2>/dev/null | grep -E "^[A-Z_]+=" | cut -d'=' -f1 || echo "")

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

    # Strip inline comments (e.g. "value # comment")
    VAR_VALUE=$(echo "$VAR_VALUE" | sed 's/ *#.*//')

    # Skip CONVEX_DEPLOYMENT and CONVEX_URL — these are local-only, not Convex env vars
    if [[ "$VAR_NAME" == "CONVEX_DEPLOYMENT" || "$VAR_NAME" == "CONVEX_URL" ]]; then
      echo -e "${BLUE}Skipping (local-only): $VAR_NAME${NC}"
      ((SKIPPED++))
      continue
    fi

    # Check if var already exists
    if var_exists "$VAR_NAME"; then
      if [ "$SYNC_ALL" = true ]; then
        echo -e "${YELLOW}Updating: $VAR_NAME${NC}"
        if npx convex env set $TARGET "$VAR_NAME" "$VAR_VALUE" 2>/dev/null; then
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
      if npx convex env set $TARGET "$VAR_NAME" "$VAR_VALUE" 2>/dev/null; then
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
echo "  Sync Complete!"
echo "========================================${NC}"
echo ""
echo -e "  ${GREEN}Added:   $ADDED${NC}"
if [ "$SYNC_ALL" = true ]; then
  echo -e "  ${YELLOW}Updated: $UPDATED${NC}"
fi
echo -e "  ${BLUE}Skipped: $SKIPPED${NC}"
if [ $ERRORS -gt 0 ]; then
  echo -e "  ${RED}Errors:  $ERRORS${NC}"
fi
echo ""
