#!/bin/bash

# Seed Production Database Script for holaaiconvex
# This script runs all seed functions in the correct order
#
# Usage:
#   ./scripts/seed-prod.sh           # Seeds production (--prod flag)
#   ./scripts/seed-prod.sh --dev     # Seeds development
#   ./scripts/seed-prod.sh --deployment <name>  # Seeds specific deployment

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PACKAGE_DIR"

# Default to production
TARGET="--prod"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dev)
      TARGET=""
      shift
      ;;
    --deployment)
      TARGET="--deployment $2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --dev                 Seed development environment"
      echo "  --deployment <name>   Seed specific deployment"
      echo "  --help, -h            Show this help message"
      echo ""
      echo "By default, seeds production (--prod)"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo "========================================"
echo "  HolaAI Convex Seeding Script"
echo "  Target: ${TARGET:-development}"
echo "========================================"
echo ""

# Step 1: Seed base content
echo "[1/3] Running seedContent..."
echo "      Creates: levels, categories, vocabulary, grammar, phrases, exercises"
RESULT=$(npx convex run holaai/seed:seedContent $TARGET)
echo "      Result: $RESULT"
echo ""

# Step 2: Seed A1 Journey
echo "[2/3] Running seedA1Journey..."
echo "      Creates: learning modules and lessons"
RESULT=$(npx convex run holaai/seed:seedA1Journey $TARGET)
echo "      Result: $RESULT"
echo ""

# Step 3: Seed lesson content
echo "[3/3] Running seedA1LessonContent..."
echo "      Creates: lesson-specific vocabulary, grammar, phrases, exercises"
RESULT=$(npx convex run holaai/seed:seedA1LessonContent $TARGET)
echo "      Result: $RESULT"
echo ""

echo "========================================"
echo "  Seeding complete!"
echo "========================================"
