import type { CapacitorConfig } from "@capacitor/cli";

const capServerUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.holaai.lifeos",
  appName: "LifeOS",
  webDir: "dist",
  // Clerk's web SDK expects `window.location.href` to be http(s) in some internal
  // flows (e.g. redirect_url params). Capacitor's default app origin is
  // `capacitor://localhost`, which can cause Clerk to throw during initialization.
  //
  // Workaround for mobile dev: serve the app from a real http(s) URL and point
  // Capacitor at it via `server.url`:
  //
  //   CAP_SERVER_URL=http://localhost:1420 pnpm cap:sync
  //
  // For production: set CAP_SERVER_URL to your hosted https URL, or use a
  // native-first Clerk integration (Clerk doesn't officially support Capacitor).
  ...(capServerUrl
    ? {
        server: {
          url: capServerUrl,
          cleartext: capServerUrl.startsWith("http://"),
        },
      }
    : {}),
  android: {
    // Android-specific config
  },
  plugins: {
    App: {
      // Enable URL scheme handling for OAuth
    },
    // Helps Cookie-based auth SDKs in native WebViews.
    CapacitorCookies: {
      enabled: true,
    },
  },
};

export default config;
