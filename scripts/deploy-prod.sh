#!/bin/bash

set -e

echo "Deploy to Production"
echo "========================"
echo "This will merge: dev -> staging -> main"
echo ""

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "Error: You have uncommitted changes. Please commit or stash them first."
    exit 1
fi

# Show current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH"
echo ""

# Master confirmation - if yes, skip all individual prompts
FORCE_ALL=false
read -p "Force all steps without individual confirmations? (y/N): " force_confirm
if [[ "$force_confirm" =~ ^[Yy]$ ]]; then
    FORCE_ALL=true
    echo "-> Will proceed with all steps automatically"
else
    echo "-> Will prompt for each step"
fi

echo ""
read -p "Proceed with deploy? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "Fetching latest changes..."
git fetch origin

echo ""
echo "Pulling latest for dev..."
git checkout dev
git pull origin dev

# Merge dev -> staging
echo ""
echo "Step 1: Merge dev -> staging"
if [[ "$FORCE_ALL" == false ]]; then
    read -p "Proceed with dev -> staging merge? (y/N): " confirm_staging
    if [[ ! "$confirm_staging" =~ ^[Yy]$ ]]; then
        echo "Skipping dev -> staging merge."
        echo "Returning to original branch ($CURRENT_BRANCH)..."
        git checkout "$CURRENT_BRANCH"
        exit 0
    fi
fi
git checkout staging
git pull origin staging
git merge dev -m "Merge dev into staging"
git push origin staging
echo "dev -> staging complete"

# Merge staging -> main
echo ""
echo "Step 2: Merge staging -> main"
if [[ "$FORCE_ALL" == false ]]; then
    read -p "Proceed with staging -> main merge? (y/N): " confirm_main
    if [[ ! "$confirm_main" =~ ^[Yy]$ ]]; then
        echo "Skipping staging -> main merge."
        echo "Returning to original branch ($CURRENT_BRANCH)..."
        git checkout "$CURRENT_BRANCH"
        exit 0
    fi
fi
git checkout main
git pull origin main
git merge staging -m "Merge staging into main"
git push origin main
echo "staging -> main complete"

echo ""
echo "Returning to original branch ($CURRENT_BRANCH)..."
git checkout "$CURRENT_BRANCH"

echo ""
echo "Deploy complete! All branches pushed."
echo "   dev -> staging -> main"
