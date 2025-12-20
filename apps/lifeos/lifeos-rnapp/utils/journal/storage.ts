import {
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  writeAsStringAsync,
  readAsStringAsync,
  deleteAsync,
  copyAsync,
} from 'expo-file-system/legacy';

export type JournalEntryType = 'photo' | 'video' | 'note';

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD format
  createdAt: number; // Unix timestamp
  updatedAt: number;
  type: JournalEntryType;

  // For photos/videos
  mediaUri?: string; // Local file path
  thumbnailUri?: string; // Thumbnail for videos

  // For notes (and optional caption for media)
  title?: string;
  content?: string;

  // Sync status
  convexId?: string;
  syncStatus: 'local' | 'syncing' | 'synced' | 'error';
  syncError?: string;
}

/**
 * Get the journal directory path for a specific user
 */
function getJournalDirectory(userId: string): string {
  return `${documentDirectory}journal/${userId}/`;
}

/**
 * Get the media directory path for a specific user
 */
function getMediaDirectory(userId: string): string {
  return `${documentDirectory}journal/${userId}/media/`;
}

/**
 * Get the thumbnails directory path for a specific user
 */
function getThumbnailsDirectory(userId: string): string {
  return `${documentDirectory}journal/${userId}/thumbnails/`;
}

/**
 * Get the metadata file path for a specific user
 */
function getMetadataFilePath(userId: string): string {
  return `${documentDirectory}journal/${userId}/metadata.json`;
}

/**
 * Initialize the journal storage directory for a user
 */
export async function initializeJournalStorage(userId: string): Promise<void> {
  const journalDir = getJournalDirectory(userId);
  const mediaDir = getMediaDirectory(userId);
  const thumbnailsDir = getThumbnailsDirectory(userId);

  const dirInfo = await getInfoAsync(journalDir);
  if (!dirInfo.exists) {
    await makeDirectoryAsync(journalDir, { intermediates: true });
  }

  const mediaDirInfo = await getInfoAsync(mediaDir);
  if (!mediaDirInfo.exists) {
    await makeDirectoryAsync(mediaDir, { intermediates: true });
  }

  const thumbnailsDirInfo = await getInfoAsync(thumbnailsDir);
  if (!thumbnailsDirInfo.exists) {
    await makeDirectoryAsync(thumbnailsDir, { intermediates: true });
  }
}

/**
 * Generate a UUID for entry identification
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDate(): string {
  return formatDateToString(new Date());
}

/**
 * Format a Date object to YYYY-MM-DD string
 */
export function formatDateToString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a YYYY-MM-DD string to Date object
 */
export function parseDateString(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Get the full path for a media file
 */
export function getMediaFilePath(userId: string, filename: string): string {
  return `${getMediaDirectory(userId)}${filename}`;
}

/**
 * Get the full path for a thumbnail file
 */
export function getThumbnailFilePath(userId: string, filename: string): string {
  return `${getThumbnailsDirectory(userId)}${filename}`;
}

/**
 * Generate a unique filename for media
 */
export function generateMediaFilename(type: 'photo' | 'video'): string {
  const id = generateUUID();
  const extension = type === 'photo' ? 'jpg' : 'mp4';
  return `${id}.${extension}`;
}

/**
 * Save journal entries metadata to storage
 */
export async function saveJournalMetadata(
  userId: string,
  entries: JournalEntry[]
): Promise<void> {
  const metadataFile = getMetadataFilePath(userId);
  await writeAsStringAsync(metadataFile, JSON.stringify(entries));
}

/**
 * Load journal entries metadata from storage
 */
export async function loadJournalMetadata(userId: string): Promise<JournalEntry[]> {
  try {
    const metadataFile = getMetadataFilePath(userId);
    const fileInfo = await getInfoAsync(metadataFile);
    if (!fileInfo.exists) {
      return [];
    }
    const content = await readAsStringAsync(metadataFile);
    return JSON.parse(content) as JournalEntry[];
  } catch {
    return [];
  }
}

/**
 * Copy media file to the journal directory
 */
export async function copyMediaToJournal(
  userId: string,
  sourceUri: string,
  type: 'photo' | 'video'
): Promise<string> {
  const filename = generateMediaFilename(type);
  const destinationUri = getMediaFilePath(userId, filename);
  await copyAsync({
    from: sourceUri,
    to: destinationUri,
  });
  return destinationUri;
}

/**
 * Delete a media file from the filesystem
 */
export async function deleteMediaFile(uri: string): Promise<void> {
  try {
    const fileInfo = await getInfoAsync(uri);
    if (fileInfo.exists) {
      await deleteAsync(uri);
    }
  } catch (error) {
    console.error('Failed to delete media file:', error);
  }
}

/**
 * Delete a journal entry's associated files
 */
export async function deleteEntryFiles(entry: JournalEntry): Promise<void> {
  if (entry.mediaUri) {
    await deleteMediaFile(entry.mediaUri);
  }
  if (entry.thumbnailUri) {
    await deleteMediaFile(entry.thumbnailUri);
  }
}

/**
 * Get entries grouped by date
 */
export function groupEntriesByDate(
  entries: JournalEntry[]
): Record<string, JournalEntry[]> {
  const grouped: Record<string, JournalEntry[]> = {};

  for (const entry of entries) {
    if (!grouped[entry.date]) {
      grouped[entry.date] = [];
    }
    grouped[entry.date].push(entry);
  }

  // Sort entries within each date by createdAt (newest first)
  for (const date in grouped) {
    grouped[date].sort((a, b) => b.createdAt - a.createdAt);
  }

  return grouped;
}

/**
 * Get entries for a specific date
 */
export function getEntriesForDate(
  entries: JournalEntry[],
  date: string
): JournalEntry[] {
  return entries
    .filter((entry) => entry.date === date)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Get unique dates that have entries, sorted newest first
 */
export function getDatesWithEntries(entries: JournalEntry[]): string[] {
  const dates = new Set(entries.map((entry) => entry.date));
  return Array.from(dates).sort((a, b) => b.localeCompare(a));
}
