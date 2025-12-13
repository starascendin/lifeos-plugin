import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { initClerk } from "tauri-plugin-clerk";
import { HashRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import LifeOSApp from "./LifeOSApp";
import "./App.css";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);
const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPublishableKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY environment variable");
}

if (!import.meta.env.VITE_CONVEX_URL) {
  throw new Error("Missing VITE_CONVEX_URL environment variable");
}

// Initialize Clerk for Tauri (patches fetch to route through Rust)
// IMPORTANT: Pass the Clerk instance from initClerk to ClerkProvider
// Otherwise ClerkProvider creates its own instance without the Tauri fetch patching
initClerk(clerkPublishableKey).then((clerk) => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <ClerkProvider
        Clerk={clerk as any}
        publishableKey={clerkPublishableKey}
        allowedRedirectProtocols={["tauri:"]}
      >
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <HashRouter>
            <Routes>
              <Route path="/" element={<App />} />
              <Route path="/lifeos/*" element={<LifeOSApp />} />
            </Routes>
          </HashRouter>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </React.StrictMode>
  );
}).catch((err) => {
  console.error("Failed to initialize Clerk:", err);
});
