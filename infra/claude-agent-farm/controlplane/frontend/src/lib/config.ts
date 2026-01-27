import { Capacitor } from '@capacitor/core';

// HARDCODED API URL for native (uses Tailscale HTTPS)
const NATIVE_API_URL = 'https://claude-farm-master.tail05d28.ts.net/api';

const getApiBase = (): string => {
  if (Capacitor.isNativePlatform()) {
    return NATIVE_API_URL;
  }
  return '/api';
};

export const API_BASE = getApiBase();

// App configuration
export const config = {
  apiBase: API_BASE,
  isNative: Capacitor.isNativePlatform(),
  platform: Capacitor.getPlatform(), // 'ios', 'android', or 'web'
};
