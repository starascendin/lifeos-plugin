# Clerk + Capacitor (iOS) Setup — LifeOS

This app is primarily a Vite + React + Tauri project, with a Capacitor iOS target added.
Clerk’s web SDK requires OAuth `redirect_url` values to be `http(s)`, while Capacitor apps typically use deep links (`lifeos://...`) to return to the app.

This repo uses an **HTTP(S) callback page** (`public/clerk-callback.html`) that immediately deep-links back into the app.

---

## 1) Required environment variables

### Development (`.env`)

- `VITE_CLERK_PUBLISHABLE_KEY=pk_test_...`
- `VITE_CONVEX_URL=https://...convex.cloud`
- `VITE_CLERK_OAUTH_REDIRECT_URL=http://localhost:1420/clerk-callback.html`

### Production (`.env.production`)

- `VITE_CLERK_PUBLISHABLE_KEY=pk_live_...`
- `VITE_CONVEX_URL=https://...convex.cloud`
- `VITE_CLERK_OAUTH_REDIRECT_URL=https://<your-vercel-domain>/clerk-callback.html`

Why the redirect URL must be `http(s)`:
- Clerk rejects non-`http(s)` OAuth redirect URLs (e.g. `lifeos://callback`) with `invalid_url_scheme`.

---

## 2) Clerk Dashboard configuration

You must configure these in the Clerk **instance that matches your publishable key** (dev vs prod).

### A) Native redirect allowlist

Add the deep link used by the app:
- `lifeos://callback`

### B) Allowed origins / Authorized origins

Add the web origin the Capacitor app is running from:

- Dev (local): `http://localhost:1420`
- Prod (Vercel/custom domain): `https://<your-vercel-domain>`

### C) OAuth redirect URLs

Add the **exact** callback URL used for Google OAuth:

- Dev: `http://localhost:1420/clerk-callback.html`
- Prod: `https://<your-vercel-domain>/clerk-callback.html`

---

## 3) Capacitor configuration in this repo

### A) Cookie support

`capacitor.config.ts` enables:
- `CapacitorCookies: { enabled: true }`

This helps cookie/session behavior in native WebViews.

### B) iOS `Info.plist` requirements

`ios/App/App/Info.plist` includes:
- `NSAppTransportSecurity` exceptions (Clerk + localhost)
- Cookie accept policy (`NSHTTPCookieAcceptPolicyAlways`)
- `WKAppBoundDomains` (Clerk domains)

These match the working reference configuration from the Capacitor Clerk tutorial project.

---

## 4) How the Capacitor OAuth flow works (important)

### A) Start OAuth

On Capacitor, the app uses:
- `redirectUrl = VITE_CLERK_OAUTH_REDIRECT_URL` (must be `http(s)`)
- opens the provider page via `@capacitor/browser`

### B) Clerk redirects to the callback page

Clerk redirects to:
- `/clerk-callback.html?...`

### C) Callback page deep-links into the app

`public/clerk-callback.html`:
- reads URL params (including `rotating_token_nonce` when present)
- redirects to `lifeos://callback?...`

### D) App receives deep link and finalizes session

`AppUrlListener`:
- listens for `App.addListener("appUrlOpen", ...)`
- extracts `rotating_token_nonce`
- calls `signIn.reload({ rotatingTokenNonce })` (or polling fallback when missing)
- calls `clerk.setActive({ session: ... })`

---

## 5) Local development (iOS simulator)

Use the HTTP dev server + point the Capacitor app at it.

Terminal A:

```bash
cd apps/lifeos/taurireact-macapp
pnpm dev:mobile
```

Terminal B:

```bash
cd apps/lifeos/taurireact-macapp
pnpm cap:sync:dev
pnpm cap:open:ios:dev
```

If you still see old behavior, uninstall the sim app:

```bash
xcrun simctl uninstall booted com.holaai.lifeos
```

Then in Xcode: **Product → Clean Build Folder**, Run.

---

## 6) Production iOS build + install on a USB-connected iPhone

### A) Ensure you have a hosted callback page

Deploy the web app to Vercel and confirm:
- `https://<your-vercel-domain>/clerk-callback.html`

Then set:
- `VITE_CLERK_OAUTH_REDIRECT_URL=https://<your-vercel-domain>/clerk-callback.html` in `.env.production`

### B) Build (Release)

```bash
cd apps/lifeos/taurireact-macapp
pnpm cap:ios:prod:build
```

### C) Install to device (requires Xcode + `devicectl`)

```bash
cd apps/lifeos/taurireact-macapp
pnpm cap:ios:prod:install
```

If UDID detection fails, provide it:

```bash
IOS_DEVICE_UDID=<your-udid> pnpm cap:ios:prod:install
```

Notes:
- First-time device signing must be set in Xcode (Team/Signing).
- If `devicectl` is unavailable (older Xcode), install by running the app from Xcode instead.

---

## 7) Common errors

### “Invalid URL scheme … expected https/http” after Google consent

Cause:
- Clerk OAuth redirect URL is not `http(s)` (e.g. `lifeos://callback`).

Fix:
- Use `VITE_CLERK_OAUTH_REDIRECT_URL` pointing to `/clerk-callback.html` on an `http(s)` origin.

### “additional_scopes is not a valid parameter”

Cause:
- Clerk rejects `additional_scopes` on `signIn.create(...)` in this flow.

Fix:
- Do not pass YouTube scopes in `signIn.create`. If you need extra Google scopes, do a separate post-sign-in consent/reauthorize flow.

