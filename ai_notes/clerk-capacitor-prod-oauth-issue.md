# Clerk + Capacitor OAuth Issue: PROD Fails, DEV Works

**Date:** 2026-01-09
**App:** LifeOS Capacitor iOS app
**Location:** `apps/lifeos/taurireact-macapp/`

## Problem Summary

Capacitor + Clerk OAuth authentication works perfectly in DEV but fails in PROD with `authorization_invalid` error.

## What Works (DEV)

- ✅ User clicks "Sign in with Google"
- ✅ OAuth flow starts with `signIn.create({ strategy: "oauth_google", redirectUrl: "http://localhost:1420/clerk-callback.html" })`
- ✅ Google consent screen opens in in-app browser
- ✅ Redirects to `http://localhost:1420/clerk-callback.html`
- ✅ Callback page deep links to `lifeos://callback?rotating_token_nonce=...`
- ✅ AppUrlListener catches deep link and activates session
- ✅ User is signed in successfully

**DEV Environment:**
```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_CLERK_OAUTH_REDIRECT_URL=http://localhost:1420/clerk-callback.html
VITE_CONVEX_URL=https://beaming-giraffe-300.convex.cloud
```

## What Fails (PROD)

- ❌ User clicks "Sign in with Google"
- ❌ OAuth flow starts with `signIn.create({ strategy: "oauth_google", redirectUrl: "https://www.rjlabs.dev/clerk-callback.html" })`
- ❌ **Error:** `{"errors":[{"message":"Unauthorized request","long_message":"You are not authorized to perform this request","code":"authorization_invalid"}],"clerk_trace_id":"..."}`
- ❌ OAuth never reaches Google - fails at Clerk validation

**PROD Environment:**
```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsucmpsYWJzLmRldiQ
VITE_CLERK_OAUTH_REDIRECT_URL=https://www.rjlabs.dev/clerk-callback.html
VITE_CONVEX_URL=https://agreeable-ibex-949.convex.cloud
CAP_SERVER_URL_PROD=https://www.rjlabs.dev/
```

## Root Cause Analysis

### Why DEV Works:
- Clerk test instances (`pk_test_*`) automatically trust localhost URLs
- No explicit whitelisting required for `localhost:*`
- More permissive security model for development

### Why PROD Fails:
- Clerk production instances (`pk_live_*`) have strict security
- Custom `redirectUrl` in `signIn.create()` must be explicitly whitelisted
- Error `authorization_invalid` indicates Clerk is rejecting the custom redirect URL

## What We've Tried

### ✅ Completed:
1. **Reverted code to working Jan 8 commit** - DEV works, PROD still fails
2. **Added to Clerk Dashboard:**
   - Native applications → Allowlist for mobile OAuth redirect: `https://www.rjlabs.dev/clerk-callback.html`
   - Mobile SSO redirect allowlist (attempted)
3. **Verified Google OAuth Console:**
   - Has `https://clerk.rjlabs.dev/v1/oauth_callback` whitelisted
4. **Verified callback page is deployed:**
   - `curl -I https://www.rjlabs.dev/clerk-callback.html` returns HTTP 200
5. **Added session handling:**
   - Sign out existing sessions before OAuth
   - Check for active sessions before/after callback
   - Better error logging with stack traces

### ❌ Still Failing:
Same error persists even after whitelisting in Clerk Dashboard

## Code References

### SignIn.tsx (lines 52-59, 220-241)
```typescript
// Sign out existing session to avoid conflicts
if (clerk.session) {
  console.log("[SignIn] Active session detected, signing out before OAuth...");
  await clerk.signOut();
  await new Promise(resolve => setTimeout(resolve, 500));
}

// Capacitor OAuth flow
const redirectUrlFromEnv = import.meta.env.VITE_CLERK_OAUTH_REDIRECT_URL;
const defaultRedirectUrl = window.location.origin.startsWith("http")
  ? `${window.location.origin}/clerk-callback.html`
  : undefined;

const redirectUrl = redirectUrlFromEnv ?? defaultRedirectUrl;

const result = await signIn.create({
  strategy: "oauth_google",
  redirectUrl,  // ← This URL causes "authorization_invalid" in PROD
});
```

### AppUrlListener.tsx (lines 40-47, 114-120)
```typescript
// Check if already signed in before processing callback
if (clerk.session) {
  console.log("[AppUrlListener] User already has active session, navigating to app");
  window.location.hash = "#/lifeos";
  return;
}

// No rotating_token_nonce in PROD - fallback to session check
if (clerk.session) {
  console.log("[AppUrlListener] Active session found, navigating to app");
  window.location.hash = "#/lifeos";
  return;
}
```

### public/clerk-callback.html
```javascript
const incoming = new URL(window.location.href);
const params = new URLSearchParams(incoming.search);
if (incoming.hash && incoming.hash.length > 1) {
  const hashParams = new URLSearchParams(incoming.hash.slice(1));
  for (const [k, v] of hashParams.entries()) {
    if (!params.has(k)) params.set(k, v);
  }
}

const deepLink = "lifeos://callback" + (params.toString() ? `?${params.toString()}` : "");
window.location.replace(deepLink);
```

## Clerk Configuration Status

### Production Instance (pk_live_Y2xlcmsucmpsYWJzLmRldiQ)

**Confirmed Settings:**
- ✅ Google OAuth enabled
- ✅ Social Connections → Google → Shows: `https://clerk.rjlabs.dev/v1/oauth_callback`
- ✅ Native applications → Allowlist for mobile OAuth redirect: `https://www.rjlabs.dev/clerk-callback.html`
- ❓ Instance mode: Unknown (need to verify NOT in development mode)
- ❓ Domains section: Unknown if `www.rjlabs.dev` is added/verified
- ❓ Paths → Allowed redirect URLs: Unknown if this separate setting exists and has the URL

### Google OAuth Console

**Confirmed Settings:**
- ✅ Authorized redirect URIs: `https://clerk.rjlabs.dev/v1/oauth_callback`

## Possible Issues to Investigate

### 1. **Clerk Dashboard Settings**
- [ ] Check if production instance is in Development Mode (should be Production Mode)
- [ ] Look for **"Paths" → "Allowed redirect URLs"** section (might be separate from Native applications)
- [ ] Check **"Configure" → "Restrictions"** for any blocking rules
- [ ] Verify **"Domains"** section has `www.rjlabs.dev` added and verified
- [ ] Check if there's a wildcard/pattern needed (e.g., `https://www.rjlabs.dev/*`)

### 2. **OAuth Flow Mismatch**
The custom `redirectUrl` parameter in `signIn.create()` might not be supported for production instances. Consider:
- [ ] Try removing `redirectUrl` parameter entirely and let Clerk handle it
- [ ] Use Clerk's built-in OAuth endpoint instead of custom callback page
- [ ] Check if Clerk SDK version supports custom redirectUrl for production

### 3. **URL Format Issues**
- [ ] Verify exact URL match (trailing slash, protocol, subdomain)
- [ ] Current: `https://www.rjlabs.dev/clerk-callback.html`
- [ ] Try without `www`: `https://rjlabs.dev/clerk-callback.html`
- [ ] Check if needs query params or hash fragment pattern

### 4. **Clerk Instance Configuration**
- [ ] Verify production instance is NOT a satellite domain
- [ ] Check if custom domain setup is required
- [ ] Verify Clerk CNAME records in DNS (if using custom domain)
- [ ] Check if origin restrictions are blocking the request

### 5. **Alternative OAuth Approach**
Since DEV works with the same code, the issue is purely configuration. Consider:
- [ ] Use Clerk's standard OAuth flow without custom redirect
- [ ] Implement OAuth using Clerk's components instead of custom flow
- [ ] Use Backend API to create OAuth token instead of client-side `signIn.create()`

## Testing Commands

```bash
# Verify callback page is accessible
curl -I https://www.rjlabs.dev/clerk-callback.html

# Check Clerk publishable key
grep "pk_live" apps/lifeos/taurireact-macapp/.env.production

# Test production build
cd apps/lifeos/taurireact-macapp
pnpm build:mobile:production
pnpm cap:open:ios:prod
```

## Expected Success Logs

When working, Safari console should show:
```
[SignIn] Using Capacitor OAuth flow with URL scheme callback...
[SignIn] Creating OAuth flow with redirect: https://www.rjlabs.dev/clerk-callback.html
[SignIn] Opening in-app browser: https://accounts.google.com/...
[AppUrlListener] OAuth callback detected
[AppUrlListener] Active session found, navigating to app
```

## Current Error Logs

```
[SignIn] Using Capacitor OAuth flow with URL scheme callback...
[SignIn] Creating OAuth flow with redirect: https://www.rjlabs.dev/clerk-callback.html
ERROR: {"errors":[{"message":"Unauthorized request","long_message":"You are not authorized to perform this request","code":"authorization_invalid"}],"clerk_trace_id":"..."}
```

## Next Steps for Investigation

1. **Verify Clerk instance mode** - Ensure NOT in development mode
2. **Check for "Paths" section** in Clerk Dashboard (separate from Native applications)
3. **Try alternative approach** - Remove `redirectUrl` parameter and use Clerk's default flow
4. **Contact Clerk support** - Provide clerk_trace_id for debugging
5. **Check Clerk SDK version** - Ensure compatible with custom redirectUrl in production

## Reference Documentation

- [Clerk: Customize your redirect URLs](https://clerk.com/docs/guides/custom-redirects)
- [Clerk: Custom OAuth flows](https://clerk.com/docs/custom-flows/oauth-connections)
- [Clerk: Frontend API errors](https://clerk.com/docs/guides/development/errors/frontend-api)
- Working DEV commit: `1a6d5336d4e3d440ae254d912a2515cb9b5bb3e7` (Jan 8, 2026)

## Key Insight

**The exact same code works in DEV but fails in PROD.** This definitively proves it's a Clerk Dashboard configuration issue, not a code issue. The custom `redirectUrl` parameter requires specific whitelisting that we haven't found yet.
