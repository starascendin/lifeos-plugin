#!/bin/bash

set -e

echo "🚀 Deploy to Production"
echo "========================"
echo "This will merge: dev -> staging -> main"
echo ""

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "❌ Error: You have uncommitted changes. Please commit or stash them first."
    exit 1
fi

# Show current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH"
echo ""

# Confirmation
read -p "Are you sure you want to proceed? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "📥 Fetching latest changes..."
git fetch origin

echo ""
echo "🔀 Merging dev -> staging..."
git checkout staging
git pull origin staging
git merge dev -m "Merge dev into staging"
git push origin staging

echo ""
echo "🔀 Merging staging -> main..."
git checkout main
git pull origin main
git merge staging -m "Merge staging into main"
git push origin main

echo ""
echo "🔙 Returning to original branch ($CURRENT_BRANCH)..."
git checkout "$CURRENT_BRANCH"

echo ""
echo "✅ Deploy complete! All branches pushed."
echo "   dev -> staging -> main"
