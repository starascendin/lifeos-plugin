import {
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  writeAsStringAsync,
  readAsStringAsync,
  deleteAsync,
  moveAsync,
  FileInfo,
} from 'expo-file-system/legacy';

export interface VoiceMemo {
  id: string;
  name: string;
  uri: string;
  duration: number; // in milliseconds
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
  // Sync fields
  convexId?: string; // Cloud ID if synced
  syncStatus: 'local' | 'syncing' | 'synced' | 'error';
  syncError?: string;
  // Transcription fields
  transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  transcript?: string;
  language?: string;
}

/**
 * Get the voice memo directory path for a specific user
 */
function getVoiceMemoDirectory(userId: string): string {
  return `${documentDirectory}voicememos/${userId}/`;
}

/**
 * Get the metadata file path for a specific user
 */
function getMetadataFilePath(userId: string): string {
  return `${documentDirectory}voicememos/${userId}/metadata.json`;
}

/**
 * Initialize the voice memo storage directory for a user
 */
export async function initializeStorage(userId: string): Promise<void> {
  const voiceMemoDir = getVoiceMemoDirectory(userId);
  const dirInfo = await getInfoAsync(voiceMemoDir);
  if (!dirInfo.exists) {
    await makeDirectoryAsync(voiceMemoDir, {
      intermediates: true,
    });
  }
}

/**
 * Generate a unique filename for a new recording
 */
export function generateMemoFilename(): string {
  const id = generateUUID();
  return `${id}.m4a`;
}

/**
 * Generate a UUID for memo identification
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get the full path for a memo file
 */
export function getMemoFilePath(userId: string, filename: string): string {
  return `${getVoiceMemoDirectory(userId)}${filename}`;
}

/**
 * Save memo metadata to storage for a user
 */
export async function saveMemoMetadata(userId: string, memos: VoiceMemo[]): Promise<void> {
  const metadataFile = getMetadataFilePath(userId);
  await writeAsStringAsync(metadataFile, JSON.stringify(memos));
}

/**
 * Load memo metadata from storage for a user
 */
export async function loadMemoMetadata(userId: string): Promise<VoiceMemo[]> {
  try {
    const metadataFile = getMetadataFilePath(userId);
    const fileInfo = await getInfoAsync(metadataFile);
    if (!fileInfo.exists) {
      return [];
    }
    const content = await readAsStringAsync(metadataFile);
    return JSON.parse(content) as VoiceMemo[];
  } catch {
    return [];
  }
}

/**
 * Delete a memo file from the filesystem
 */
export async function deleteMemoFile(uri: string): Promise<void> {
  try {
    const fileInfo = await getInfoAsync(uri);
    if (fileInfo.exists) {
      await deleteAsync(uri);
    }
  } catch (error) {
    console.error('Failed to delete memo file:', error);
  }
}

/**
 * Move a recorded file to the voice memo directory for a user
 */
export async function moveToMemoDirectory(
  userId: string,
  sourceUri: string,
  filename: string
): Promise<string> {
  const destinationUri = getMemoFilePath(userId, filename);
  await moveAsync({
    from: sourceUri,
    to: destinationUri,
  });
  return destinationUri;
}

/**
 * Get file info for a memo
 */
export async function getMemoFileInfo(uri: string): Promise<FileInfo> {
  return getInfoAsync(uri);
}

// Legacy paths for migration
const LEGACY_VOICE_MEMO_DIRECTORY = `${documentDirectory}voicememos/`;
const LEGACY_METADATA_FILE = `${documentDirectory}voicememo-metadata.json`;

/**
 * Check if legacy memos exist that need migration
 */
export async function hasLegacyMemos(): Promise<boolean> {
  try {
    const fileInfo = await getInfoAsync(LEGACY_METADATA_FILE);
    return fileInfo.exists;
  } catch {
    return false;
  }
}

/**
 * Migrate legacy memos to user-specific storage.
 * This moves memos from the old shared location to the user's directory.
 */
export async function migrateLegacyMemos(userId: string): Promise<void> {
  try {
    // Check if legacy metadata exists
    const legacyFileInfo = await getInfoAsync(LEGACY_METADATA_FILE);
    if (!legacyFileInfo.exists) {
      return; // No legacy memos to migrate
    }

    // Ensure user directory exists
    await initializeStorage(userId);

    // Check if user already has memos (don't overwrite)
    const userMemos = await loadMemoMetadata(userId);
    if (userMemos.length > 0) {
      // User already has memos, delete legacy file to prevent re-migration
      await deleteAsync(LEGACY_METADATA_FILE);
      return;
    }

    // Load legacy memos
    const legacyContent = await readAsStringAsync(LEGACY_METADATA_FILE);
    const legacyMemos = JSON.parse(legacyContent) as VoiceMemo[];

    if (legacyMemos.length === 0) {
      await deleteAsync(LEGACY_METADATA_FILE);
      return;
    }

    // Move each audio file and update URIs
    const migratedMemos: VoiceMemo[] = [];
    for (const memo of legacyMemos) {
      try {
        // Extract filename from old URI
        const filename = memo.uri.split('/').pop();
        if (!filename) continue;

        const oldUri = memo.uri;
        const newUri = getMemoFilePath(userId, filename);

        // Check if old file exists
        const oldFileInfo = await getInfoAsync(oldUri);
        if (oldFileInfo.exists) {
          // Move the audio file
          await moveAsync({
            from: oldUri,
            to: newUri,
          });
        }

        // Update memo with new URI
        migratedMemos.push({
          ...memo,
          uri: newUri,
          syncStatus: memo.syncStatus ?? 'local',
        });
      } catch (error) {
        console.error(`Failed to migrate memo ${memo.id}:`, error);
        // Continue with other memos even if one fails
      }
    }

    // Save migrated memos to user's metadata file
    if (migratedMemos.length > 0) {
      await saveMemoMetadata(userId, migratedMemos);
    }

    // Delete legacy metadata file
    await deleteAsync(LEGACY_METADATA_FILE);

    console.log(`Migrated ${migratedMemos.length} voice memos to user storage`);
  } catch (error) {
    console.error('Failed to migrate legacy memos:', error);
  }
}
