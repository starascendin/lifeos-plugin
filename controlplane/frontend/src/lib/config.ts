import { Capacitor } from '@capacitor/core';

// API configuration
// On web (dev): Uses Vite proxy, so /api works
// On native: Needs full URL to your backend
const getApiBase = (): string => {
  // Check if we're on a native platform
  if (Capacitor.isNativePlatform()) {
    // For native apps, use the configured API URL
    // This should be set to your production/staging API
    return import.meta.env.VITE_NATIVE_API_URL || 'https://your-api.example.com';
  }

  // For web, use relative path (Vite proxy handles it in dev)
  return '/api';
};

export const API_BASE = getApiBase();

// App configuration
export const config = {
  apiBase: API_BASE,
  isNative: Capacitor.isNativePlatform(),
  platform: Capacitor.getPlatform(), // 'ios', 'android', or 'web'
};
