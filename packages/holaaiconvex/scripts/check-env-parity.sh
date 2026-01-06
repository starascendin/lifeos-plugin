#!/bin/bash

# Check Environment Variables Parity Across All Convex Environments
# Compares DEV vs STAGING vs PROD env var keys
# DEV is treated as the source of truth
#
# Environments:
#   DEV:     beaming-giraffe-300 (holaaiconvex-staging dev cloud)
#   STAGING: adorable-firefly-704 (holaaiconvex-staging production cloud)
#   PROD:    agreeable-ibex-949 (holaconvex-prod production cloud)
#
# Usage:
#   ./scripts/check-env-parity.sh           # Check parity (show only differences)
#   ./scripts/check-env-parity.sh --verbose # Show all keys including matches

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PACKAGE_DIR"

# Defaults
VERBOSE=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --verbose|-v)
      VERBOSE=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --verbose, -v         Show all env var keys (including matches)"
      echo "  --help, -h            Show this help message"
      echo ""
      echo "Compares env var KEYS across DEV, STAGING, and PROD environments."
      echo "DEV is treated as the source of truth."
      echo ""
      echo "Environments:"
      echo "  DEV:     beaming-giraffe-300 (holaaiconvex-staging dev cloud)"
      echo "  STAGING: adorable-firefly-704 (holaaiconvex-staging production cloud)"
      echo "  PROD:    agreeable-ibex-949 (holaconvex-prod production cloud)"
      echo ""
      echo "Exit codes:"
      echo "  0 - All env var keys match (parity)"
      echo "  1 - Env var keys differ (no parity)"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

echo ""
echo -e "${BLUE}========================================"
echo "  Convex Env Var Parity Check"
echo "  (DEV is source of truth)"
echo "========================================${NC}"
echo ""

# Function to extract CONVEX_URL from env file
get_convex_url() {
  local env_file="$1"
  if [ ! -f "$env_file" ]; then
    echo ""
    return
  fi
  grep -E "^CONVEX_URL=" "$env_file" | cut -d'=' -f2- | tr -d '"' | tr -d "'"
}

# Function to get env var keys from a Convex deployment
get_env_keys() {
  local url="$1"
  local prod_flag="$2"
  if [ -n "$prod_flag" ]; then
    npx convex env list --url "$url" --prod 2>/dev/null | grep -E "^[A-Z_][A-Z0-9_]*=" | cut -d'=' -f1 | sort
  else
    npx convex env list --url "$url" 2>/dev/null | grep -E "^[A-Z_][A-Z0-9_]*=" | cut -d'=' -f1 | sort
  fi
}

# Get URLs from env files
STAGING_PROJECT_URL=$(get_convex_url ".env.local")
PROD_PROJECT_URL=$(get_convex_url ".env.production")

# Validate URLs
if [ -z "$STAGING_PROJECT_URL" ]; then
  echo -e "${RED}Error: Could not find CONVEX_URL in .env.local${NC}"
  exit 1
fi

if [ -z "$PROD_PROJECT_URL" ]; then
  echo -e "${RED}Error: Could not find CONVEX_URL in .env.production${NC}"
  exit 1
fi

echo -e "${CYAN}DEV:${NC}     $STAGING_PROJECT_URL (dev cloud)"
echo -e "${CYAN}STAGING:${NC} $STAGING_PROJECT_URL (--prod, production cloud)"
echo -e "${CYAN}PROD:${NC}    $PROD_PROJECT_URL"
echo ""

# Fetch env var keys from all environments
echo -e "${BLUE}Fetching env vars from DEV...${NC}"
DEV_KEYS=$(get_env_keys "$STAGING_PROJECT_URL" "")

echo -e "${BLUE}Fetching env vars from STAGING...${NC}"
STAGING_KEYS=$(get_env_keys "$STAGING_PROJECT_URL" "prod")

echo -e "${BLUE}Fetching env vars from PROD...${NC}"
PROD_KEYS=$(get_env_keys "$PROD_PROJECT_URL" "")

echo ""

# Compare DEV (source) against STAGING and PROD
# Keys missing in STAGING (present in DEV but not STAGING)
MISSING_IN_STAGING=$(comm -23 <(echo "$DEV_KEYS") <(echo "$STAGING_KEYS") | grep -v '^$' || true)
# Keys missing in PROD (present in DEV but not PROD)
MISSING_IN_PROD=$(comm -23 <(echo "$DEV_KEYS") <(echo "$PROD_KEYS") | grep -v '^$' || true)
# Extra keys in STAGING (present in STAGING but not DEV)
EXTRA_IN_STAGING=$(comm -13 <(echo "$DEV_KEYS") <(echo "$STAGING_KEYS") | grep -v '^$' || true)
# Extra keys in PROD (present in PROD but not DEV)
EXTRA_IN_PROD=$(comm -13 <(echo "$DEV_KEYS") <(echo "$PROD_KEYS") | grep -v '^$' || true)
# Keys in all environments
IN_ALL=$(comm -12 <(echo "$DEV_KEYS") <(comm -12 <(echo "$STAGING_KEYS") <(echo "$PROD_KEYS")) | grep -v '^$' || true)

# Count items (handle empty strings)
count_lines() {
  local str="$1"
  if [ -z "$str" ]; then
    echo 0
  else
    echo "$str" | grep -c . || echo 0
  fi
}

MISSING_IN_STAGING_COUNT=$(count_lines "$MISSING_IN_STAGING")
MISSING_IN_PROD_COUNT=$(count_lines "$MISSING_IN_PROD")
EXTRA_IN_STAGING_COUNT=$(count_lines "$EXTRA_IN_STAGING")
EXTRA_IN_PROD_COUNT=$(count_lines "$EXTRA_IN_PROD")
IN_ALL_COUNT=$(count_lines "$IN_ALL")
DEV_COUNT=$(count_lines "$DEV_KEYS")
STAGING_COUNT=$(count_lines "$STAGING_KEYS")
PROD_COUNT=$(count_lines "$PROD_KEYS")

# Report results
HAS_DIFF=false

if [ -n "$MISSING_IN_STAGING" ]; then
  HAS_DIFF=true
  echo -e "${YELLOW}Missing in STAGING ($MISSING_IN_STAGING_COUNT) - need to add:${NC}"
  echo "$MISSING_IN_STAGING" | while read -r key; do
    [ -n "$key" ] && echo -e "  ${YELLOW}- $key${NC}"
  done
  echo ""
fi

if [ -n "$MISSING_IN_PROD" ]; then
  HAS_DIFF=true
  echo -e "${RED}Missing in PROD ($MISSING_IN_PROD_COUNT) - need to add:${NC}"
  echo "$MISSING_IN_PROD" | while read -r key; do
    [ -n "$key" ] && echo -e "  ${RED}- $key${NC}"
  done
  echo ""
fi

if [ -n "$EXTRA_IN_STAGING" ]; then
  HAS_DIFF=true
  echo -e "${MAGENTA}Extra in STAGING ($EXTRA_IN_STAGING_COUNT) - not in DEV:${NC}"
  echo "$EXTRA_IN_STAGING" | while read -r key; do
    [ -n "$key" ] && echo -e "  ${MAGENTA}- $key${NC}"
  done
  echo ""
fi

if [ -n "$EXTRA_IN_PROD" ]; then
  HAS_DIFF=true
  echo -e "${MAGENTA}Extra in PROD ($EXTRA_IN_PROD_COUNT) - not in DEV:${NC}"
  echo "$EXTRA_IN_PROD" | while read -r key; do
    [ -n "$key" ] && echo -e "  ${MAGENTA}- $key${NC}"
  done
  echo ""
fi

if [ "$VERBOSE" = true ] && [ -n "$IN_ALL" ]; then
  echo -e "${GREEN}Keys in ALL environments ($IN_ALL_COUNT):${NC}"
  echo "$IN_ALL" | while read -r key; do
    [ -n "$key" ] && echo -e "  ${GREEN}- $key${NC}"
  done
  echo ""
fi

# Summary
echo -e "${BLUE}========================================"
echo "  Summary"
echo "========================================${NC}"
echo ""
echo -e "  ${CYAN}DEV total:${NC}            $DEV_COUNT"
echo -e "  ${CYAN}STAGING total:${NC}        $STAGING_COUNT"
echo -e "  ${CYAN}PROD total:${NC}           $PROD_COUNT"
echo ""
echo -e "  ${GREEN}In all environments:${NC}  $IN_ALL_COUNT"
echo -e "  ${YELLOW}Missing in STAGING:${NC}   $MISSING_IN_STAGING_COUNT"
echo -e "  ${RED}Missing in PROD:${NC}      $MISSING_IN_PROD_COUNT"
echo -e "  ${MAGENTA}Extra in STAGING:${NC}     $EXTRA_IN_STAGING_COUNT"
echo -e "  ${MAGENTA}Extra in PROD:${NC}        $EXTRA_IN_PROD_COUNT"
echo ""

if [ "$HAS_DIFF" = true ]; then
  echo -e "${RED}PARITY CHECK FAILED - env vars differ between environments${NC}"
  echo ""
  exit 1
else
  echo -e "${GREEN}PARITY CHECK PASSED - all env var keys match across DEV, STAGING, and PROD${NC}"
  echo ""
  exit 0
fi
