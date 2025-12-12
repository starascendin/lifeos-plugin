import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { Id } from '@holaai/convex/_generated/dataModel';

/**
 * Upload a local audio file to Convex storage
 *
 * @param localUri - Local file URI (e.g., file:///path/to/audio.m4a)
 * @param generateUploadUrl - Function to get upload URL from Convex
 * @returns The storage ID from Convex
 */
export async function uploadAudioToConvex(
  localUri: string,
  generateUploadUrl: () => Promise<string>
): Promise<Id<'_storage'>> {
  // Get the upload URL from Convex
  const uploadUrl = await generateUploadUrl();

  // Read the file as base64
  const base64Data = await readAsStringAsync(localUri, {
    encoding: EncodingType.Base64,
  });

  // Convert base64 to blob
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'audio/mp4' });

  // Upload to Convex storage
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'audio/mp4',
    },
    body: blob,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload audio: ${response.status}`);
  }

  const result = await response.json();
  return result.storageId as Id<'_storage'>;
}

/**
 * Determine the sync status of a memo
 */
export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';

export interface SyncedMemo {
  localId: string;
  convexId?: string;
  syncStatus: SyncStatus;
  syncError?: string;
}

/**
 * Check if a local memo has been synced to Convex
 */
export function getMemoSyncStatus(
  localId: string,
  syncedMemos: Map<string, string>
): SyncStatus {
  return syncedMemos.has(localId) ? 'synced' : 'local';
}
