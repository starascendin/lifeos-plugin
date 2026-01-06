#!/bin/bash

# Check Environment Variables Parity Across Vercel Environments
# Compares Preview vs Staging vs Production env var keys
# Preview is treated as the source of truth
#
# Environments:
#   preview:    Preview deployments (dev branch)
#   staging:    Staging deployments (staging branch)
#   production: Production deployments (main branch)
#
# Usage:
#   ./scripts/check-vercel-env-parity.sh           # Check parity (show only differences)
#   ./scripts/check-vercel-env-parity.sh --verbose # Show all keys including matches

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"
MONOREPO_ROOT="$(cd "$PACKAGE_DIR/../../.." && pwd)"

# Change to monorepo root where .vercel is located
cd "$MONOREPO_ROOT"

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
      echo "Compares env var KEYS across Preview, Staging, and Production environments."
      echo "Preview is treated as the source of truth."
      echo ""
      echo "Environments:"
      echo "  preview:    Preview deployments (dev branch)"
      echo "  staging:    Staging deployments (staging branch)"
      echo "  production: Production deployments (main branch)"
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
echo "  Vercel Env Var Parity Check"
echo "  (Preview is source of truth)"
echo "========================================${NC}"
echo ""

# Function to get env var keys from a Vercel environment
get_env_keys() {
  local env="$1"
  # Parse vercel env list output - extract first column (name), skip header row
  npx vercel env list "$env" 2>/dev/null | \
    grep -E "^\s*[A-Z_][A-Z0-9_]*\s+" | \
    awk '{print $1}' | \
    sort | \
    uniq
}

# Fetch env var keys from all environments
echo -e "${BLUE}Fetching env vars from Preview...${NC}"
PREVIEW_KEYS=$(get_env_keys "preview")

echo -e "${BLUE}Fetching env vars from Staging...${NC}"
STAGING_KEYS=$(get_env_keys "staging")

echo -e "${BLUE}Fetching env vars from Production...${NC}"
PROD_KEYS=$(get_env_keys "production")

echo ""

# Compare Preview (source) against Staging and Production
# Keys missing in Staging (present in Preview but not Staging)
MISSING_IN_STAGING=$(comm -23 <(echo "$PREVIEW_KEYS") <(echo "$STAGING_KEYS") | grep -v '^$' || true)
# Keys missing in Production (present in Preview but not Production)
MISSING_IN_PROD=$(comm -23 <(echo "$PREVIEW_KEYS") <(echo "$PROD_KEYS") | grep -v '^$' || true)
# Extra keys in Staging (present in Staging but not Preview)
EXTRA_IN_STAGING=$(comm -13 <(echo "$PREVIEW_KEYS") <(echo "$STAGING_KEYS") | grep -v '^$' || true)
# Extra keys in Production (present in Production but not Preview)
EXTRA_IN_PROD=$(comm -13 <(echo "$PREVIEW_KEYS") <(echo "$PROD_KEYS") | grep -v '^$' || true)
# Keys in all environments
IN_ALL=$(comm -12 <(echo "$PREVIEW_KEYS") <(comm -12 <(echo "$STAGING_KEYS") <(echo "$PROD_KEYS")) | grep -v '^$' || true)

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
PREVIEW_COUNT=$(count_lines "$PREVIEW_KEYS")
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
  echo -e "${RED}Missing in PRODUCTION ($MISSING_IN_PROD_COUNT) - need to add:${NC}"
  echo "$MISSING_IN_PROD" | while read -r key; do
    [ -n "$key" ] && echo -e "  ${RED}- $key${NC}"
  done
  echo ""
fi

if [ -n "$EXTRA_IN_STAGING" ]; then
  HAS_DIFF=true
  echo -e "${MAGENTA}Extra in STAGING ($EXTRA_IN_STAGING_COUNT) - not in Preview:${NC}"
  echo "$EXTRA_IN_STAGING" | while read -r key; do
    [ -n "$key" ] && echo -e "  ${MAGENTA}- $key${NC}"
  done
  echo ""
fi

if [ -n "$EXTRA_IN_PROD" ]; then
  HAS_DIFF=true
  echo -e "${MAGENTA}Extra in PRODUCTION ($EXTRA_IN_PROD_COUNT) - not in Preview:${NC}"
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
echo -e "  ${CYAN}Preview total:${NC}        $PREVIEW_COUNT"
echo -e "  ${CYAN}Staging total:${NC}        $STAGING_COUNT"
echo -e "  ${CYAN}Production total:${NC}     $PROD_COUNT"
echo ""
echo -e "  ${GREEN}In all environments:${NC}  $IN_ALL_COUNT"
echo -e "  ${YELLOW}Missing in STAGING:${NC}   $MISSING_IN_STAGING_COUNT"
echo -e "  ${RED}Missing in PRODUCTION:${NC} $MISSING_IN_PROD_COUNT"
echo -e "  ${MAGENTA}Extra in STAGING:${NC}     $EXTRA_IN_STAGING_COUNT"
echo -e "  ${MAGENTA}Extra in PRODUCTION:${NC}  $EXTRA_IN_PROD_COUNT"
echo ""

if [ "$HAS_DIFF" = true ]; then
  echo -e "${RED}PARITY CHECK FAILED - env vars differ between environments${NC}"
  echo ""
  exit 1
else
  echo -e "${GREEN}PARITY CHECK PASSED - all env var keys match across Preview, Staging, and Production${NC}"
  echo ""
  exit 0
fi
