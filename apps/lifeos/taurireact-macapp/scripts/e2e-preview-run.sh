#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
MONOREPO_ROOT="$(cd "$APP_DIR/../../.." && pwd)"

ENV_E2E_FILE="$APP_DIR/.env.e2e"
ENV_E2E_LOCAL_FILE="$APP_DIR/.env.e2e.local"

if [ ! -f "$ENV_E2E_FILE" ]; then
  echo "[e2e-preview] Missing $ENV_E2E_FILE"
  echo "[e2e-preview] Create it (or copy from .env.e2e.example)."
  exit 1
fi

set -a
source "$ENV_E2E_FILE"
if [ -f "$ENV_E2E_LOCAL_FILE" ]; then
  source "$ENV_E2E_LOCAL_FILE"
fi
set +a

if [ -z "${CONVEX_DEPLOY_KEY:-}" ]; then
  echo "[e2e-preview] Missing CONVEX_DEPLOY_KEY."
  echo "[e2e-preview] Put your preview deploy key into $ENV_E2E_FILE or $ENV_E2E_LOCAL_FILE"
  exit 1
fi

PREVIEW_NAME="${E2E_CONVEX_PREVIEW_NAME:-lifeos-e2e-$(date +%Y%m%d-%H%M%S)}"

echo "[e2e-preview] Creating/updating Convex preview deployment: $PREVIEW_NAME"

DEPLOY_LOG="$(mktemp -t convex-e2e-preview.XXXXXX.log)"
TMP_ENV="$(mktemp -t lifeos-e2e-env.XXXXXX)"
cleanup_tmp() { rm -f "$DEPLOY_LOG" "$TMP_ENV"; }
trap cleanup_tmp EXIT

cd "$MONOREPO_ROOT"

set +e
CONVEX_DEPLOY_KEY="$CONVEX_DEPLOY_KEY" \
  pnpm --filter @holaai/convex exec convex deploy --preview-create "$PREVIEW_NAME" --yes \
  2>&1 | tee "$DEPLOY_LOG"
DEPLOY_EXIT_CODE=$?
set -e

if [ $DEPLOY_EXIT_CODE -ne 0 ]; then
  echo "[e2e-preview] convex deploy failed."
  exit $DEPLOY_EXIT_CODE
fi

# Ensure required Convex env vars exist on this preview deployment (auth).
CONVEX_ENV_FILE="$MONOREPO_ROOT/packages/holaaiconvex/.env.local"
if [ -f "$CONVEX_ENV_FILE" ]; then
  set -a
  source "$CONVEX_ENV_FILE"
  set +a
fi

if [ -n "${CLERK_JWT_ISSUER_DOMAIN:-}" ]; then
  echo "[e2e-preview] Setting preview env: CLERK_JWT_ISSUER_DOMAIN"
  CONVEX_DEPLOY_KEY="$CONVEX_DEPLOY_KEY" \
    pnpm --filter @holaai/convex exec convex env --preview-name "$PREVIEW_NAME" \
      set CLERK_JWT_ISSUER_DOMAIN "$CLERK_JWT_ISSUER_DOMAIN"
else
  echo "[e2e-preview] Warning: CLERK_JWT_ISSUER_DOMAIN not found (expected in packages/holaaiconvex/.env.local)."
  echo "[e2e-preview] If auth fails, set it on the preview deployment and rerun."
fi

CONVEX_URL_PREVIEW="$(
  grep -Eo 'https?://[^[:space:]]+\\.(convex\\.cloud|convex\\.site)[^[:space:]]*' "$DEPLOY_LOG" \
    | head -n 1 \
    | sed 's/[),.;]$//'
)"

if [ -z "$CONVEX_URL_PREVIEW" ]; then
  echo "[e2e-preview] Could not detect preview CONVEX_URL from deploy output."
  echo "[e2e-preview] Inspect the deploy output above, then set VITE_CONVEX_URL manually in $ENV_E2E_LOCAL_FILE"
  exit 1
fi

# Preserve any existing local secrets (e.g. CONVEX_DEPLOY_KEY), only override the URL/name.
if [ -f "$ENV_E2E_LOCAL_FILE" ]; then
  grep -v -E '^(E2E_CONVEX_PREVIEW_NAME|VITE_CONVEX_URL)=' "$ENV_E2E_LOCAL_FILE" > "$TMP_ENV" || true
else
  : > "$TMP_ENV"
fi

{
  echo "# Auto-generated overrides by scripts/e2e-preview-run.sh"
  echo "E2E_CONVEX_PREVIEW_NAME=$PREVIEW_NAME"
  echo "VITE_CONVEX_URL=$CONVEX_URL_PREVIEW"
} >> "$TMP_ENV"

mv "$TMP_ENV" "$ENV_E2E_LOCAL_FILE"

echo "[e2e-preview] Using VITE_CONVEX_URL=$CONVEX_URL_PREVIEW"
echo "[e2e-preview] Wrote overrides to $ENV_E2E_LOCAL_FILE"

cd "$APP_DIR"
pnpm test:e2e

echo ""
echo "[e2e-preview] Done."
echo "[e2e-preview] Preview deployment kept: $PREVIEW_NAME"
echo "[e2e-preview] Delete it in the Convex dashboard if you don't want to keep it (CLI doesn't expose deletion)."
