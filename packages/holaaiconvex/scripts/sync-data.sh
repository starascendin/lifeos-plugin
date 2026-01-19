#!/bin/bash

# Sync Data Between Convex Environments
# This script exports data from one environment and imports to another,
# fixing Clerk tokenIdentifier mismatches along the way.
#
# Usage:
#   ./scripts/sync-data.sh prod staging    # Sync prod → staging
#   ./scripts/sync-data.sh staging prod    # Sync staging → prod

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PACKAGE_DIR"

# Clerk domains for token replacement
PROD_CLERK="clerk.rjlabs.dev"
STAGING_CLERK="climbing-barnacle-85.clerk.accounts.dev"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse args
FROM=$1  # "prod" or "staging"
TO=$2    # "prod" or "staging"

if [ -z "$FROM" ] || [ -z "$TO" ]; then
  echo -e "${BLUE}Convex Data Sync${NC}"
  echo ""
  echo "Usage: $0 <from> <to>"
  echo ""
  echo "Arguments:"
  echo "  from    Source environment: 'prod' or 'staging'"
  echo "  to      Target environment: 'prod' or 'staging'"
  echo ""
  echo "Examples:"
  echo "  $0 prod staging    # Copy all data from prod to staging"
  echo "  $0 staging prod    # Copy all data from staging to prod"
  echo ""
  echo -e "${YELLOW}Warning: This will REPLACE all data in the target environment!${NC}"
  exit 1
fi

# Validate args
if [[ "$FROM" != "prod" && "$FROM" != "staging" ]]; then
  echo -e "${RED}Error: 'from' must be 'prod' or 'staging', got: $FROM${NC}"
  exit 1
fi

if [[ "$TO" != "prod" && "$TO" != "staging" ]]; then
  echo -e "${RED}Error: 'to' must be 'prod' or 'staging', got: $TO${NC}"
  exit 1
fi

if [[ "$FROM" == "$TO" ]]; then
  echo -e "${RED}Error: 'from' and 'to' cannot be the same${NC}"
  exit 1
fi

echo ""
echo -e "${BLUE}========================================"
echo "  Convex Data Sync"
echo "  From: $FROM → To: $TO"
echo "========================================${NC}"
echo ""

# Confirm if syncing TO prod
if [[ "$TO" == "prod" ]]; then
  echo -e "${YELLOW}WARNING: You are about to REPLACE production data!${NC}"
  echo -e "${YELLOW}This will overwrite ALL production data with staging data.${NC}"
  echo ""
  read -p "Type 'yes' to confirm: " CONFIRM
  if [[ "$CONFIRM" != "yes" ]]; then
    echo "Aborted."
    exit 0
  fi
  echo ""
fi

# Create temp directory
WORK_DIR=$(mktemp -d)
echo -e "${BLUE}Working directory: $WORK_DIR${NC}"
echo ""

# Cleanup on exit
cleanup() {
  if [ -d "$WORK_DIR" ]; then
    rm -rf "$WORK_DIR"
    echo -e "${BLUE}Cleaned up temp files${NC}"
  fi
}
trap cleanup EXIT

# 1. Export from source
echo -e "${GREEN}[1/5] Exporting from $FROM...${NC}"
if [ "$FROM" == "prod" ]; then
  npx convex export --prod --path "$WORK_DIR/backup.zip"
else
  npx convex export --path "$WORK_DIR/backup.zip"
fi
echo ""

# 2. Unzip
echo -e "${GREEN}[2/5] Unzipping backup...${NC}"
unzip -q "$WORK_DIR/backup.zip" -d "$WORK_DIR/data"
echo "  Extracted to $WORK_DIR/data"
echo ""

# 3. Fix tokenIdentifier in users.jsonl
echo -e "${GREEN}[3/5] Fixing Clerk tokenIdentifiers...${NC}"
USERS_FILE="$WORK_DIR/data/users.jsonl"

if [ -f "$USERS_FILE" ]; then
  if [ "$FROM" == "prod" ] && [ "$TO" == "staging" ]; then
    # Prod → Staging: replace prod clerk domain with staging
    echo "  Replacing: $PROD_CLERK → $STAGING_CLERK"
    sed -i '' "s|$PROD_CLERK|$STAGING_CLERK|g" "$USERS_FILE"
  elif [ "$FROM" == "staging" ] && [ "$TO" == "prod" ]; then
    # Staging → Prod: replace staging clerk domain with prod
    echo "  Replacing: $STAGING_CLERK → $PROD_CLERK"
    sed -i '' "s|$STAGING_CLERK|$PROD_CLERK|g" "$USERS_FILE"
  fi
  echo "  Done"
else
  echo -e "${YELLOW}  Warning: users.jsonl not found, skipping token fix${NC}"
fi
echo ""

# 4. Re-zip
echo -e "${GREEN}[4/5] Re-zipping backup...${NC}"
cd "$WORK_DIR/data"
zip -q -r ../fixed_backup.zip .
cd "$PACKAGE_DIR"
echo "  Created $WORK_DIR/fixed_backup.zip"
echo ""

# 5. Import to target
echo -e "${GREEN}[5/5] Importing to $TO...${NC}"
if [ "$TO" == "prod" ]; then
  npx convex import --prod "$WORK_DIR/fixed_backup.zip"
else
  npx convex import "$WORK_DIR/fixed_backup.zip"
fi
echo ""

echo -e "${GREEN}========================================"
echo "  Sync Complete!"
echo "  Data copied from $FROM to $TO"
echo "========================================${NC}"
echo ""
