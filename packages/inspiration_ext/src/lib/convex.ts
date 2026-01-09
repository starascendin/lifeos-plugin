import { ConvexReactClient } from "convex/react";

// Convex URL from environment
const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  throw new Error("Missing VITE_CONVEX_URL environment variable");
}

export const convex = new ConvexReactClient(convexUrl);
