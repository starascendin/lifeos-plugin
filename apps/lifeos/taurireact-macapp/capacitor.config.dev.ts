import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.bryanliu.lifeosnexus.dev",
  appName: "LifeOS Nexus DEV",
  webDir: "dist",
  plugins: {
    CapacitorUpdater: {
      autoUpdate: false,
    },
  },
};

export default config;
