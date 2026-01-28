#!/bin/bash
set -e

# Configuration
IMAGE_NAME="ghcr.io/starascendin/hola-monorepo-controlplane"
VERSION_FILE="VERSION"
K8S_DEPLOYMENT="controlplane"
K8S_NAMESPACE="controlplane"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get current version
CURRENT_VERSION=$(cat "$VERSION_FILE")
echo -e "${BLUE}Current version: ${GREEN}v${CURRENT_VERSION}${NC}"

# Bump patch version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
NEW_PATCH=$((PATCH + 1))
NEW_VERSION="${MAJOR}.${MINOR}.${NEW_PATCH}"
echo -e "${BLUE}New version: ${GREEN}v${NEW_VERSION}${NC}"

# Update VERSION file
echo "$NEW_VERSION" > "$VERSION_FILE"

# Build timestamp
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo -e "${BLUE}Building image...${NC}"
docker build \
    --platform linux/amd64 \
    --build-arg VERSION="${NEW_VERSION}" \
    --build-arg BUILD_TIME="${BUILD_TIME}" \
    -t "${IMAGE_NAME}:v${NEW_VERSION}" \
    -t "${IMAGE_NAME}:latest" \
    .

echo -e "${BLUE}Pushing images...${NC}"
docker push "${IMAGE_NAME}:v${NEW_VERSION}"
docker push "${IMAGE_NAME}:latest"

echo -e "${BLUE}Updating deployment to v${NEW_VERSION}...${NC}"
kubectl set image deployment/${K8S_DEPLOYMENT} \
    controlplane="${IMAGE_NAME}:v${NEW_VERSION}" \
    -n ${K8S_NAMESPACE}

echo -e "${BLUE}Waiting for rollout...${NC}"
kubectl rollout status deployment/${K8S_DEPLOYMENT} -n ${K8S_NAMESPACE} --timeout=120s

echo -e "${GREEN}✓ Deployed v${NEW_VERSION}${NC}"
