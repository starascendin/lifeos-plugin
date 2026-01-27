import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agentfarm.controlplane',
  appName: 'Agent Farm',
  webDir: 'build',
  ios: {
    contentInset: 'never',
    scrollEnabled: false,
    scheme: 'Agent Farm',
    backgroundColor: '#0a0a0f',
  },
  server: {
    allowNavigation: ['*.r2.dev'],
  },
  plugins: {
    CapacitorUpdater: {
      autoUpdate: false,
    },
  },
};

export default config;
