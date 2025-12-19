import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
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

  // Upload file directly using expo-file-system
  // This avoids the Blob API which doesn't support ArrayBuffer in React Native
  const response = await uploadAsync(uploadUrl, localUri, {
    httpMethod: 'POST',
    uploadType: FileSystemUploadType.BINARY_CONTENT,
    headers: {
      'Content-Type': 'audio/mp4',
    },
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Failed to upload audio: ${response.status}`);
  }

  const result = JSON.parse(response.body);
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
