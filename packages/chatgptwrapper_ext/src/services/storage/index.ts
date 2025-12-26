/**
 * Storage abstraction layer for council conversations.
 * Supports both Chrome extension storage and server-side HTTP storage.
 */

export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  getBytesInUse?(): Promise<number>;
}

export type StorageMode = 'chrome' | 'server';

/**
 * Detect the current storage mode based on chrome API availability.
 */
export function detectStorageMode(): StorageMode {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local ? 'chrome' : 'server';
}

/**
 * Create a storage adapter based on the current mode.
 */
export function createStorage(mode?: StorageMode): StorageAdapter {
  const effectiveMode = mode ?? detectStorageMode();

  if (effectiveMode === 'chrome') {
    return new ChromeStorageAdapter();
  }
  return new ServerStorageAdapter();
}

// Singleton instance
let storageInstance: StorageAdapter | null = null;

/**
 * Get the storage instance (singleton).
 */
export function getStorage(): StorageAdapter {
  if (!storageInstance) {
    storageInstance = createStorage();
  }
  return storageInstance;
}

/**
 * Chrome extension storage adapter using chrome.storage.local.
 */
export class ChromeStorageAdapter implements StorageAdapter {
  private isAvailable(): boolean {
    return typeof chrome !== 'undefined' && !!chrome.storage?.local;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) return null;
    try {
      const result = await chrome.storage.local.get(key);
      return (result[key] as T) ?? null;
    } catch (error) {
      console.error('[ChromeStorage] Get error:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (error) {
      console.error('[ChromeStorage] Set error:', error);
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await chrome.storage.local.remove(key);
    } catch (error) {
      console.error('[ChromeStorage] Remove error:', error);
      throw error;
    }
  }

  async getBytesInUse(): Promise<number> {
    if (!this.isAvailable()) return 0;
    try {
      return await chrome.storage.local.getBytesInUse();
    } catch (error) {
      console.error('[ChromeStorage] getBytesInUse error:', error);
      return 0;
    }
  }
}

/**
 * Server-side storage adapter that proxies to the extension via HTTP endpoints.
 * The server forwards requests to the extension via WebSocket.
 */
export class ServerStorageAdapter implements StorageAdapter {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    // Use window.location.origin if in browser, otherwise default to localhost
    this.baseUrl = baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3456');
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      // Handle conversation index
      if (key === 'council_conversation_index') {
        const response = await fetch(`${this.baseUrl}/conversations`);
        if (!response.ok) return null;
        const data = await response.json();
        // Server returns raw array from extension, or wrapped object
        if (Array.isArray(data)) {
          return data as T;
        }
        return data.success ? (data.conversations as T) : (data as T);
      }

      // Handle individual conversations
      if (key.startsWith('council_conversation_')) {
        const id = key.replace('council_conversation_', '');
        const response = await fetch(`${this.baseUrl}/conversations/${id}`);
        if (!response.ok) return null;
        const data = await response.json();
        // Server returns raw conversation from extension, or wrapped object
        if (data && !('success' in data)) {
          return data as T;
        }
        return data.success ? (data.conversation as T) : null;
      }

      // For other keys, return null (server mode doesn't support arbitrary storage)
      return null;
    } catch (error) {
      console.error('[ServerStorage] Get error:', error);
      return null;
    }
  }

  async set<T>(_key: string, _value: T): Promise<void> {
    // Server mode doesn't directly write - extension handles saves
    // Conversations are saved automatically by the extension after council execution
    // This is intentionally a no-op
  }

  async remove(key: string): Promise<void> {
    try {
      // Handle conversation deletion
      if (key.startsWith('council_conversation_')) {
        const id = key.replace('council_conversation_', '');
        await fetch(`${this.baseUrl}/conversations/${id}`, { method: 'DELETE' });
      }
    } catch (error) {
      console.error('[ServerStorage] Remove error:', error);
    }
  }

  // Server storage doesn't track bytes
  async getBytesInUse(): Promise<number> {
    return 0;
  }
}
