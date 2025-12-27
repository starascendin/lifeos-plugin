# Clerk + Tauri Production Setup Guide

This document describes how Clerk authentication is configured for the Tauri desktop app, including the differences between development and production builds.

## Overview

Clerk doesn't officially support Tauri/Electron desktop apps. The main challenges are:
1. Tauri webviews don't handle cookies the same way as browsers
2. OAuth flows require special handling for native apps
3. Production Clerk instances have stricter security requirements than development instances

## Architecture

```
┌─────────────────┐     ┌─────────────┐     ┌─────────────┐
│  Tauri App      │────▶│   Clerk     │────▶│   Google    │
│  (localhost)    │◀────│   (OAuth)   │◀────│   OAuth     │
└─────────────────┘     └─────────────┘     └─────────────┘
        │
        ▼
┌─────────────────┐
│  Convex Backend │
│  (JWT verify)   │
└─────────────────┘
```

## Key Components

### 1. Tauri Rust Plugin (`src-tauri/src/lib.rs`)

The Clerk plugin is initialized with the publishable key:

```rust
.plugin(
    tauri_plugin_clerk::ClerkPluginBuilder::new()
        .publishable_key(
            option_env!("VITE_CLERK_PUBLISHABLE_KEY").unwrap_or(
                "pk_test_...",  // Fallback for dev
            ),
        )
        .with_tauri_store()
        .build(),
)
```

**Important**: `option_env!()` reads environment variables at **compile time**, not runtime. This means `VITE_CLERK_PUBLISHABLE_KEY` must be set when building the app.

### 2. OAuth Flow (`src/components/auth/SignIn.tsx`)

The OAuth flow uses `@fabianlars/tauri-plugin-oauth` to:
1. Start a localhost HTTP server on a fixed port (3847)
2. Create a Clerk signIn with the localhost callback URL
3. Open the external browser for Google OAuth
4. Listen for the callback on localhost
5. Complete authentication with Clerk

### 3. Environment Configuration

| Environment | Clerk Key | Convex URL | Clerk Domain |
|-------------|-----------|------------|--------------|
| Development | `pk_test_...` | beaming-giraffe-300 | climbing-barnacle-85.clerk.accounts.dev |
| Staging | `pk_test_...` | adorable-firefly-704 | climbing-barnacle-85.clerk.accounts.dev |
| Production | `pk_live_...` | agreeable-ibex-949 | clerk.rjlabs.dev |

## Production Build Setup

### Step 1: Configure npm Script

The `tauri:production` script in `package.json` must include the Clerk publishable key:

```json
{
  "scripts": {
    "tauri:production": "TAURI_BUILD_MODE=production VITE_CLERK_PUBLISHABLE_KEY=pk_live_YOUR_KEY tauri build -c src-tauri/tauri.production.conf.json"
  }
}
```

Without this, the Rust code falls back to the test key, causing a mismatch with the production Convex backend.

### Step 2: Configure Convex Environment Variable

In the **Convex Dashboard** (not just local .env files):

1. Go to [dashboard.convex.dev](https://dashboard.convex.dev)
2. Select your production deployment
3. Go to **Settings → Environment Variables**
4. Add: `CLERK_JWT_ISSUER_DOMAIN` = `https://clerk.rjlabs.dev` (your production Clerk domain)

This is used by `convex/auth.config.ts` to validate JWT tokens.

### Step 3: Configure Clerk Redirect URLs

In the **Clerk Dashboard** for your production instance:

1. Go to **Configure → Native applications**
2. Find **"Allowlist for mobile SSO redirect"**
3. Add: `http://localhost:3847/callback`

This allows Clerk to redirect back to your Tauri app after OAuth.

### Step 4: Build

```bash
pnpm tauri:production
```

## Development vs Production Differences

### OAuth Callback Behavior

| Aspect | Development (pk_test_) | Production (pk_live_) |
|--------|------------------------|----------------------|
| Localhost redirect | Auto-allowed | Must be in allowlist |
| `rotating_token_nonce` | Included in callback URL | NOT included |
| Session completion | Via nonce exchange | Via server-side polling |

### Why Production Doesn't Include Nonce

Production Clerk instances have stricter security. Instead of passing the nonce in the callback URL (which could be intercepted), Clerk updates the signIn status server-side. The app must poll to detect when authentication completes.

### Polling Implementation

```typescript
// Production mode: No nonce in callback, poll signIn status
if (!rotatingTokenNonce) {
  let attempts = 0;
  while (attempts < 10) {
    const reloadedSignIn = await signIn.reload();
    if (reloadedSignIn.status === "complete" && reloadedSignIn.createdSessionId) {
      await clerk.setActive({ session: reloadedSignIn.createdSessionId });
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }
}
```

## Troubleshooting

### Error: "No auth provider found matching the given token"

**Cause**: Mismatch between Clerk instance and Convex configuration.

**Fix**:
1. Verify `VITE_CLERK_PUBLISHABLE_KEY` is set at build time (check npm script)
2. Verify `CLERK_JWT_ISSUER_DOMAIN` is set in Convex Dashboard
3. Ensure they match (dev key → dev domain, prod key → prod domain)

### Error: "redirect url does not match an authorized redirect URI"

**Cause**: The localhost callback URL isn't in Clerk's allowlist.

**Fix**: Add `http://localhost:3847/callback` to Clerk Dashboard → Native applications → Allowlist for mobile SSO redirect

### Error: "Missing rotating_token_nonce in callback URL"

**Cause**: Production Clerk doesn't include nonce in callback (this is expected behavior).

**Fix**: The SignIn component should fall back to polling mode when nonce is missing (already implemented).

## Files Reference

| File | Purpose |
|------|---------|
| `package.json` | Build scripts with env vars |
| `src-tauri/src/lib.rs` | Rust Clerk plugin init |
| `src/components/auth/SignIn.tsx` | OAuth flow implementation |
| `src/main.tsx` | ClerkProvider + ConvexProvider setup |
| `.env.production` | Frontend env vars (Vite) |
| `packages/holaaiconvex/.env.production` | Convex env vars (reference) |
| `packages/holaaiconvex/convex/auth.config.ts` | Convex JWT validation config |

## Related Resources

- [tauri-plugin-clerk](https://github.com/Nipsuli/tauri-plugin-clerk) - Community Clerk SDK for Tauri
- [tauri-plugin-oauth](https://github.com/FabianLars/tauri-plugin-oauth) - OAuth helper for Tauri
- [Clerk Native Apps Docs](https://clerk.com/docs/deployments/deploy-expo) - Similar setup for Expo/React Native
