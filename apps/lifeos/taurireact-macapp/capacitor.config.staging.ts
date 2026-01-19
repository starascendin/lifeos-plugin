import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.bryanliu.lifeosnexus.staging",
  appName: "LifeOS Nexus Staging",
  webDir: "dist",
  plugins: {
    CapacitorUpdater: {
      // For internal testing - auto update disabled, manual control
      autoUpdate: false,
    },
  },
};

export default config;
