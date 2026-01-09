import React from "react";
import ReactDOM from "react-dom/client";
import {
  AuthenticateWithRedirectCallback,
  ClerkProvider,
  useAuth,
} from "@clerk/clerk-react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App";
import LifeOSApp from "./LifeOSApp";
import { ConfigProvider } from "./lib/config";
import { isTauri, isCapacitor } from "./lib/platform";
import { AppUrlListener } from "./components/auth/AppUrlListener";
import { CapOAuthStart } from "./components/auth/CapOAuthStart";
import "./App.css";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);
const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPublishableKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY environment variable");
}

if (!import.meta.env.VITE_CONVEX_URL) {
  throw new Error("Missing VITE_CONVEX_URL environment variable");
}

async function initializeApp() {
  let clerkInstance = undefined;

  // Only use tauri-plugin-clerk when running in Tauri
  // It patches fetch to route through Rust for proper cookie handling
  if (isTauri) {
    const { initClerk } = await import("tauri-plugin-clerk");
    clerkInstance = await initClerk(clerkPublishableKey);
  }

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <ClerkProvider
        {...(clerkInstance ? { Clerk: clerkInstance as any } : {})}
        publishableKey={clerkPublishableKey}
        allowedRedirectProtocols={
          isTauri ? ["tauri:"] : isCapacitor ? ["lifeos:"] : undefined
        }
      >
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <ConfigProvider>
            <HashRouter>
              {/* Capacitor URL listener for OAuth callbacks */}
              {isCapacitor && <AppUrlListener />}
	              <Routes>
                {/* On web/Capacitor, redirect / to /lifeos. On Tauri, show menu bar app */}
                <Route
                  path="/"
                  element={isTauri ? <App /> : <Navigate to="/lifeos" replace />}
                />
	                <Route
	                  path="/sso-callback"
	                  element={
	                    <AuthenticateWithRedirectCallback
	                      // HashRouter: these should include the hash.
	                      signInFallbackRedirectUrl="/#/lifeos"
	                      signUpFallbackRedirectUrl="/#/lifeos"
	                    />
	                  }
	                />
	                <Route path="/cap-oauth-start" element={<CapOAuthStart />} />
	                <Route path="/lifeos/*" element={<LifeOSApp />} />
	              </Routes>
            </HashRouter>
          </ConfigProvider>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </React.StrictMode>
  );
}

initializeApp().catch((err) => {
  console.error("Failed to initialize app:", err);
});
