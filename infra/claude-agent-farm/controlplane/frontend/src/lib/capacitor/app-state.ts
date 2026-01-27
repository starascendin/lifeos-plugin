import { Capacitor } from '@capacitor/core';
import { App, type AppState } from '@capacitor/app';

type AppStateCallback = (isActive: boolean) => void;

const listeners: AppStateCallback[] = [];
let isInitialized = false;

/**
 * Initialize app state listeners for handling background/foreground transitions.
 * Call this once at app startup.
 */
export async function initAppState(): Promise<void> {
  if (!Capacitor.isNativePlatform() || isInitialized) {
    return;
  }

  isInitialized = true;

  // Listen for app state changes
  App.addListener('appStateChange', (state: AppState) => {
    console.log('[AppState] State changed:', state.isActive ? 'active' : 'background');
    notifyListeners(state.isActive);
  });

  // Listen for app being brought to foreground via URL
  App.addListener('appUrlOpen', (data) => {
    console.log('[AppState] App opened via URL:', data.url);
  });

  // Listen for back button (Android)
  App.addListener('backButton', () => {
    console.log('[AppState] Back button pressed');
  });

  console.log('[AppState] Initialized');
}

/**
 * Register a callback to be notified when app state changes.
 * @param callback Function called with isActive boolean
 * @returns Unsubscribe function
 */
export function onAppStateChange(callback: AppStateCallback): () => void {
  listeners.push(callback);
  return () => {
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
}

/**
 * Check if app is currently in foreground.
 */
export async function isAppActive(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return true; // Web is always "active"
  }

  const state = await App.getState();
  return state.isActive;
}

/**
 * Notify all registered listeners of state change.
 */
function notifyListeners(isActive: boolean): void {
  listeners.forEach((callback) => {
    try {
      callback(isActive);
    } catch (error) {
      console.error('[AppState] Listener error:', error);
    }
  });
}

/**
 * Check if running on native platform.
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}
