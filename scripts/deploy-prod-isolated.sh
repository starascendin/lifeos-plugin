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
echo "This will: dev -> main + deploy Convex to production"
echo ""
echo "Convex deployment:"
echo "  - packages/holaaiconvex -> agreeable-ibex-949 (production)"
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

# Fetch latest for main
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
echo "Step 1: Merge dev -> main"
echo "========================="

# Create a temp main branch from origin/main
git checkout -B temp-main origin/main
echo "Created temp-main from origin/main"

# Merge temp-dev into temp-main
git merge temp-dev -m "Merge dev into main"
echo "Merged dev into temp-main"

# Push temp-main to origin/main
git push origin temp-main:main
echo "Pushed to origin/main"
echo "dev -> main complete"

echo ""
echo "Updating local main branch..."
git -C "$REPO_ROOT" branch -f main origin/main 2>/dev/null && echo "  ✓ main updated" || echo "  ✗ main update failed (may have local changes)"

echo ""
echo "Step 2: Deploy Convex to production"
echo "===================================="

# Install dependencies
echo "Installing dependencies..."
pnpm install --frozen-lockfile

# Copy decrypted environment variables from main repo (already decrypted there)
echo "Copying environment variables from main repo..."
copy_env_files() {
    local src_dir="$1"
    local dst_dir="$2"
    for f in "$src_dir"/.env*; do
        [ -f "$f" ] || continue
        [[ "$f" == *.age ]] && continue  # Skip encrypted files
        local filename=$(basename "$f")
        if [ -f "$f" ]; then
            cp "$f" "$dst_dir/$filename" 2>/dev/null && echo "  ✓ Copied $filename" || true
        fi
    done
}

# Copy env files for holaaiconvex (needed for deploy)
copy_env_files "$REPO_ROOT/packages/holaaiconvex" "$WORKTREE_PATH/packages/holaaiconvex"
echo "Environment files copied."

# Deploy Convex to production (agreeable-ibex-949)
echo "Deploying Convex to production (agreeable-ibex-949)..."
NODE_OPTIONS="--max-old-space-size=8192" pnpm --filter @holaai/convex deploy:prod

echo ""
echo "Deploy complete!"
echo "================"
echo "  ✓ dev -> main (pushed)"
echo "  ✓ Convex deployed to production (agreeable-ibex-949)"
echo ""
echo "Your main worktree at $REPO_ROOT was not modified."
echo "Local main branch has been updated to match origin."

exit 0
