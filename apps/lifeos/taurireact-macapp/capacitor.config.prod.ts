import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.bryanliu.lifeosnexus",
  appName: "LifeOS Nexus",
  webDir: "dist",
  plugins: {
    CapacitorUpdater: {
      // For internal testing - auto update disabled, manual control
      autoUpdate: false,
    },
  },
};

export default config;
