#!/bin/bash

set -e

# Parse arguments
YES_FLAG=false
for arg in "$@"; do
    case $arg in
        --yes|-y)
            YES_FLAG=true
            ;;
    esac
done

REPO_ROOT=$(git rev-parse --show-toplevel)
REPO_NAME=$(basename "$REPO_ROOT")
TIMESTAMP=$(date +%s)
WORKTREE_PATH="$HOME/.claude-worktrees/$REPO_NAME/deploy-temp-$TIMESTAMP"

echo "Deploy to Production (Isolated Worktree)"
echo "========================================="
echo "This will merge: dev -> staging -> main"
echo ""

# Get the current local dev branch commit (before creating worktree)
DEV_COMMIT=$(git rev-parse dev)
echo "Using local dev branch at commit: $(git rev-parse --short dev)"
echo ""

echo "Creating isolated worktree for deployment..."
echo "Location: $WORKTREE_PATH"
echo ""

# Create worktree directory if it doesn't exist
mkdir -p "$(dirname "$WORKTREE_PATH")"

# Fetch latest for staging and main
echo "Fetching latest from origin..."
git fetch origin

# Create worktree from the local dev commit (detached HEAD to avoid branch conflicts)
git worktree add "$WORKTREE_PATH" "$DEV_COMMIT" --detach

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

# Move into worktree
cd "$WORKTREE_PATH"

echo ""
echo "Working in isolated worktree (detached HEAD mode)"
echo "Current commit: $(git rev-parse --short HEAD)"
echo ""

# Confirmation prompts (unless --yes)
if [[ "$YES_FLAG" == true ]]; then
    echo "-> --yes flag: Proceeding with all steps automatically"
else
    read -p "Proceed with deploy? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
fi

# Create temp-dev branch from the local dev commit
git checkout -B temp-dev "$DEV_COMMIT"
echo "Created temp-dev from local dev branch"

echo ""
echo "Step 1: Merge dev -> staging"
echo "============================"

# Create a temp staging branch from origin/staging
git checkout -B temp-staging origin/staging
echo "Created temp-staging from origin/staging"

# Merge temp-dev into temp-staging
git merge temp-dev -m "Merge dev into staging"
echo "Merged dev into temp-staging"

# Push temp-staging to origin/staging
git push origin temp-staging:staging
echo "Pushed to origin/staging"
echo "dev -> staging complete"

echo ""
echo "Step 2: Merge staging -> main"
echo "============================="

# Create a temp main branch from origin/main
git checkout -B temp-main origin/main
echo "Created temp-main from origin/main"

# Merge the updated staging (which is now temp-staging) into temp-main
git merge temp-staging -m "Merge staging into main"
echo "Merged staging into temp-main"

# Push temp-main to origin/main
git push origin temp-main:main
echo "Pushed to origin/main"
echo "staging -> main complete"

echo ""
echo "Updating local staging and main branches..."
# Update local branches to match origin (fast-forward only)
# Using -C to run in original repo, not the worktree
git -C "$REPO_ROOT" branch -f staging origin/staging 2>/dev/null && echo "  ✓ staging updated" || echo "  ✗ staging update failed (may have local changes)"
git -C "$REPO_ROOT" branch -f main origin/main 2>/dev/null && echo "  ✓ main updated" || echo "  ✗ main update failed (may have local changes)"

echo ""
echo "Deploy complete! All branches pushed."
echo "   dev -> staging -> main"
echo ""
echo "Your main worktree at $REPO_ROOT was not modified."
echo "Local staging and main branches have been updated to match origin."

exit 0
