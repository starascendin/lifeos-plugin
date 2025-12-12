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
}

const VOICE_MEMO_DIRECTORY = `${documentDirectory}voicememos/`;
const METADATA_FILE = `${documentDirectory}voicememo-metadata.json`;

/**
 * Initialize the voice memo storage directory
 */
export async function initializeStorage(): Promise<void> {
  const dirInfo = await getInfoAsync(VOICE_MEMO_DIRECTORY);
  if (!dirInfo.exists) {
    await makeDirectoryAsync(VOICE_MEMO_DIRECTORY, {
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
export function getMemoFilePath(filename: string): string {
  return `${VOICE_MEMO_DIRECTORY}${filename}`;
}

/**
 * Save memo metadata to storage
 */
export async function saveMemoMetadata(memos: VoiceMemo[]): Promise<void> {
  await writeAsStringAsync(METADATA_FILE, JSON.stringify(memos));
}

/**
 * Load memo metadata from storage
 */
export async function loadMemoMetadata(): Promise<VoiceMemo[]> {
  try {
    const fileInfo = await getInfoAsync(METADATA_FILE);
    if (!fileInfo.exists) {
      return [];
    }
    const content = await readAsStringAsync(METADATA_FILE);
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
 * Move a recorded file to the voice memo directory
 */
export async function moveToMemoDirectory(
  sourceUri: string,
  filename: string
): Promise<string> {
  const destinationUri = getMemoFilePath(filename);
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
