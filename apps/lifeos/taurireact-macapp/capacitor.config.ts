import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.holaai.lifeos",
  appName: "LifeOS",
  webDir: "dist",
  ios: {
    scheme: "LifeOS",
  },
  android: {
    // Android-specific config
  },
  plugins: {
    App: {
      // Enable URL scheme handling for OAuth
    },
  },
};

export default config;
