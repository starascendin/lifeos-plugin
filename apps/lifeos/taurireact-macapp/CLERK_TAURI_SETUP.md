# Clerk + Tauri Integration Guide

## Overview

Integrating Clerk authentication with Tauri requires special handling because:
1. Tauri webviews don't support cookies the same way browsers do
2. OAuth redirects need to go through a localhost callback server
3. The Clerk instance must be shared between `tauri-plugin-clerk` and `@clerk/clerk-react`

## Required Packages

### JavaScript (package.json)
```json
{
  "dependencies": {
    "@clerk/clerk-react": "^5.0.0",
    "tauri-plugin-clerk": "^0.1.0",
    "@fabianlars/tauri-plugin-oauth": "^2",
    "@tauri-apps/plugin-http": "^2",
    "@tauri-apps/plugin-shell": "^2"
  }
}
```

### Rust (Cargo.toml)
```toml
[dependencies]
tauri-plugin-clerk = "0.1"
tauri-plugin-http = "2"
tauri-plugin-shell = "2"
tauri-plugin-oauth = "2"
```

## Configuration

### 1. Tauri Rust Setup (src-tauri/src/lib.rs)

```rust
.plugin(tauri_plugin_http::init())
.plugin(tauri_plugin_shell::init())
.plugin(tauri_plugin_oauth::init())
.plugin(
    tauri_plugin_clerk::ClerkPluginBuilder::new()
        .publishable_key("pk_test_xxx")
        .with_tauri_store()  // Optional: persist session
        .build()
)
```

### 2. Tauri Capabilities (src-tauri/capabilities/default.json)

```json
{
  "permissions": [
    "http:default",
    {
      "identifier": "http:default",
      "allow": [
        { "url": "https://*/**" }
      ]
    },
    "shell:allow-open",
    "oauth:allow-start",
    "oauth:allow-cancel",
    "clerk:default"
  ]
}
```

### 3. React Entry Point (src/main.tsx)

**Critical**: Pass the Clerk instance from `initClerk()` to `ClerkProvider`:

```tsx
import { ClerkProvider } from "@clerk/clerk-react";
import { initClerk } from "tauri-plugin-clerk";

initClerk(publishableKey).then((clerk) => {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <ClerkProvider
      Clerk={clerk as any}  // Pass the initialized instance
      publishableKey={publishableKey}
      allowedRedirectProtocols={["tauri:"]}
    >
      <App />
    </ClerkProvider>
  );
});
```

**Why?** Without passing the Clerk instance, ClerkProvider creates its own instance that doesn't have the Tauri fetch patching, causing 401 errors in production builds.

### 4. OAuth Sign-In Component

Use `@fabianlars/tauri-plugin-oauth` to handle OAuth callbacks:

```tsx
import { useSignIn, useSignUp, useClerk } from "@clerk/clerk-react";
import { start, onUrl, cancel } from "@fabianlars/tauri-plugin-oauth";
import { open } from "@tauri-apps/plugin-shell";

const handleSignIn = async () => {
  // Start localhost OAuth server
  const port = await start();
  const redirectUrl = `http://localhost:${port}/callback`;

  // Create OAuth sign-in
  const result = await signIn.create({
    strategy: "oauth_google",
    redirectUrl,
  });

  const externalUrl = result.firstFactorVerification?.externalVerificationRedirectURL;

  // Listen for callback
  await onUrl(async (url) => {
    const callbackUrl = new URL(url);
    const rotatingTokenNonce = callbackUrl.searchParams.get("rotating_token_nonce");

    // Complete OAuth with nonce
    const reloadedSignIn = await signIn.reload({ rotatingTokenNonce });

    // Handle new user (transfer) vs existing user
    if (reloadedSignIn.firstFactorVerification?.status === "transferable") {
      const newSignUp = await signUp.create({ transfer: true });
      const reloadedSignUp = await newSignUp.reload({ rotatingTokenNonce });
      await clerk.setActive({ session: reloadedSignUp.createdSessionId });
    } else {
      await clerk.setActive({ session: reloadedSignIn.createdSessionId });
    }

    await cancel(port);
  });

  // Open OAuth URL in external browser
  await open(externalUrl.toString());
};
```

**Key Points:**
- Use `rotatingTokenNonce` from callback URL to complete OAuth handshake
- Handle "transferable" status for new users
- Use `clerk.setActive()` from `useClerk()` hook

## Backend (Convex) Setup

### Environment Variables
- `CLERK_SECRET_KEY`: Your Clerk secret key (must match the publishable key environment - dev/prod)

### Getting OAuth Tokens

```typescript
import { createClerkClient } from "@clerk/backend";

export const getGoogleOAuthToken = action({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const clerkUserId = identity.subject;

    const clerk = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY
    });

    const tokens = await clerk.users.getUserOauthAccessToken(
      clerkUserId,
      "oauth_google"
    );

    return { token: tokens.data[0].token };
  },
});
```

## Common Issues

### 1. 401 Errors on `/environment` and `/client` in Production Build

**Cause**: ClerkProvider creating its own Clerk instance without Tauri fetch patching.

**Fix**: Pass the Clerk instance from `initClerk()` to ClerkProvider via the `Clerk` prop.

### 2. OAuth Callback Not Completing Session

**Cause**: Not using `rotatingTokenNonce` when reloading the sign-in.

**Fix**: Extract `rotating_token_nonce` from callback URL and pass to `signIn.reload({ rotatingTokenNonce })`.

### 3. "Failed to parse header value" in Backend

**Cause**: `CLERK_SECRET_KEY` has extra whitespace or newline characters.

**Fix**: Re-copy the secret key and ensure no trailing whitespace.

### 4. Dev Mode Works But Production Doesn't

**Cause**: In dev mode, the app runs at `http://localhost` which works with standard Clerk. In production, the webview origin is `tauri://localhost` which requires the fetch patching.

**Fix**: Ensure `tauri-plugin-clerk` is properly initialized and the Clerk instance is passed to ClerkProvider.

## Clerk Dashboard Configuration

1. **Native Applications**: Enable under Configure → Native applications
2. **Google OAuth Scopes**: Configure required scopes (e.g., YouTube) under SSO Connections → Google
3. **Redirect URIs**: No special configuration needed for Tauri (uses localhost callback)
