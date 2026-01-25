import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agentfarm.controlplane',
  appName: 'Agent Farm',
  webDir: 'build',
  ios: {
    contentInset: 'automatic',
    scheme: 'Agent Farm',
  },
  plugins: {
    CapacitorUpdater: {
      autoUpdate: true,
      // Capgo cloud settings (configure after signup at https://capgo.app)
      // statsUrl: 'https://api.capgo.app/stats',
      // channelUrl: 'https://api.capgo.app/channel_self',
      // updateUrl: 'https://api.capgo.app/updates',

      // Or self-hosted settings (point to your k3s backend):
      // statsUrl: 'https://your-api.example.com/api/app/stats',
      // channelUrl: 'https://your-api.example.com/api/app/channel',
      // updateUrl: 'https://your-api.example.com/api/app/updates',
    },
  },
};

export default config;
