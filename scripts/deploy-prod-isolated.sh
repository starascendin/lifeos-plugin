#!/bin/bash

set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
REPO_NAME=$(basename "$REPO_ROOT")
TIMESTAMP=$(date +%s)
WORKTREE_PATH="$HOME/.claude-worktrees/$REPO_NAME/deploy-temp-$TIMESTAMP"

echo "Deploy to Production (Isolated Worktree)"
echo "========================================="
echo ""
echo "Creating isolated worktree for deployment..."
echo "Location: $WORKTREE_PATH"
echo ""

# Create worktree directory if it doesn't exist
mkdir -p "$(dirname "$WORKTREE_PATH")"

# Create worktree from current HEAD (detached, we'll checkout what we need inside)
git worktree add "$WORKTREE_PATH" --detach

# Cleanup function to ensure worktree is removed even on failure
cleanup() {
    echo ""
    echo "Cleaning up worktree..."
    cd "$REPO_ROOT"
    git worktree remove "$WORKTREE_PATH" --force 2>/dev/null || true
    echo "Worktree cleaned up."
}

# Set trap to cleanup on exit (success or failure)
trap cleanup EXIT

# Run the actual deploy script in the worktree
cd "$WORKTREE_PATH"

# Pass through all arguments (including --yes)
bash scripts/deploy-prod.sh "$@"
DEPLOY_EXIT_CODE=$?

exit $DEPLOY_EXIT_CODE
