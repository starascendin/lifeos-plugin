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
    allowsLinkPreview: false,
  },
  server: {
    allowNavigation: ['*.r2.dev', '*.tail05d28.ts.net'],
    cleartext: true,
  },
  plugins: {
    CapacitorUpdater: {
      autoUpdate: false,
    },
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
