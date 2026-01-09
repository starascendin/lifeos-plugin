#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

if [ ! -f "$APP_DIR/.env.production" ]; then
  echo "[cap:sync:prod] Missing $APP_DIR/.env.production"
  exit 1
fi

# Allow overriding values from the caller environment (useful in CI or one-off runs).
CAP_SERVER_URL_PROD_OVERRIDE="${CAP_SERVER_URL_PROD:-}"
VITE_CLERK_OAUTH_REDIRECT_URL_OVERRIDE="${VITE_CLERK_OAUTH_REDIRECT_URL:-}"

set -a
# shellcheck disable=SC1090
source "$APP_DIR/.env.production"
set +a

if [ -n "$CAP_SERVER_URL_PROD_OVERRIDE" ]; then
  CAP_SERVER_URL_PROD="$CAP_SERVER_URL_PROD_OVERRIDE"
fi
if [ -n "$VITE_CLERK_OAUTH_REDIRECT_URL_OVERRIDE" ]; then
  VITE_CLERK_OAUTH_REDIRECT_URL="$VITE_CLERK_OAUTH_REDIRECT_URL_OVERRIDE"
fi

if [ -z "${CAP_SERVER_URL_PROD:-}" ] && [ -z "${VITE_CLERK_OAUTH_REDIRECT_URL:-}" ]; then
  echo "[cap:sync:prod] Missing production hosted URL configuration."
  echo "[cap:sync:prod] Set at least one of:"
  echo "  - CAP_SERVER_URL_PROD=https://<your-vercel-domain>"
  echo "  - VITE_CLERK_OAUTH_REDIRECT_URL=https://<your-vercel-domain>/clerk-callback.html"
  echo ""
  echo "[cap:sync:prod] With Clerk pk_live_* you generally cannot ship the embedded capacitor://localhost origin."
  exit 1
fi

if [ -n "${CAP_SERVER_URL_PROD:-}" ] && ! [[ "$CAP_SERVER_URL_PROD" =~ ^https?:// ]]; then
  echo "[cap:sync:prod] CAP_SERVER_URL_PROD must start with http(s)://"
  exit 1
fi

if [ -n "${VITE_CLERK_OAUTH_REDIRECT_URL:-}" ] && ! [[ "$VITE_CLERK_OAUTH_REDIRECT_URL" =~ ^https?:// ]]; then
  echo "[cap:sync:prod] VITE_CLERK_OAUTH_REDIRECT_URL must start with http(s)://"
  exit 1
fi

CAP_ORIGIN="${CAP_SERVER_URL_PROD:-}"
if [ -z "$CAP_ORIGIN" ] && [ -n "${VITE_CLERK_OAUTH_REDIRECT_URL:-}" ]; then
  CAP_ORIGIN="$(node -e 'console.log(new URL(process.env.VITE_CLERK_OAUTH_REDIRECT_URL).origin)')"
fi

if [ -z "$CAP_ORIGIN" ]; then
  echo "[cap:sync:prod] Could not determine CAP_SERVER_URL"
  exit 1
fi

export CAP_SERVER_URL="$CAP_ORIGIN"

echo "[cap:sync:prod] Capacitor server.url: $CAP_SERVER_URL"

cd "$APP_DIR"
CAP_ENV=prod npx cap sync
