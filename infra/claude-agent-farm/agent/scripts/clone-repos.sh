#!/bin/bash
set -euo pipefail

# Clone repositories specified in REPOS environment variable
# Format: comma-separated list of repo URLs
# Example: REPOS="https://github.com/user/repo1,https://github.com/user/repo2"

if [ -z "${REPOS:-}" ]; then
    echo "No repositories to clone"
    exit 0
fi

WORKSPACE="/home/node/workspace"
cd "$WORKSPACE"

# Configure git
git config --global user.email "agent@claude.local"
git config --global user.name "Claude Agent"

# Configure GitHub authentication if PAT is available
if [ -n "${GITHUB_PAT:-}" ]; then
    git config --global url."https://${GITHUB_PAT}@github.com/".insteadOf "https://github.com/"
    echo "GitHub authentication configured"
fi

# Clone each repository
IFS=',' read -ra REPO_LIST <<< "$REPOS"
for repo in "${REPO_LIST[@]}"; do
    repo=$(echo "$repo" | xargs)  # Trim whitespace

    if [ -z "$repo" ]; then
        continue
    fi

    # Extract repo name from URL
    repo_name=$(basename "$repo" .git)

    echo "Cloning: $repo -> $repo_name"

    if [ -d "$repo_name" ]; then
        echo "Repository already exists, pulling latest..."
        cd "$repo_name"
        git pull --ff-only || true
        cd "$WORKSPACE"
    else
        git clone --depth 1 "$repo" "$repo_name"
    fi
done

echo "All repositories cloned successfully"
ls -la "$WORKSPACE"
