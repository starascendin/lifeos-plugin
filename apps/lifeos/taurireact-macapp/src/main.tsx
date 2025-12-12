import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { initClerk } from "tauri-plugin-clerk";
import App from "./App";
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
initClerk(clerkPublishableKey).then(() => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <ClerkProvider
        publishableKey={clerkPublishableKey}
        allowedRedirectProtocols={["tauri:"]}
      >
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <App />
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </React.StrictMode>
  );
}).catch((err) => {
  console.error("Failed to initialize Clerk:", err);
});
