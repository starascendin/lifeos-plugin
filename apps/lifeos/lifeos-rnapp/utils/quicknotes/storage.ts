import AsyncStorage from '@react-native-async-storage/async-storage';

export interface QuickNote {
  id: string;
  text: string;
  createdAt: number;
  updatedAt: number;
}

export const QUICK_NOTES_KEY = '@lifeos/quick_notes';

/**
 * Generate a UUID for note identification
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Load all quick notes from storage
 */
export async function loadQuickNotes(): Promise<QuickNote[]> {
  try {
    const stored = await AsyncStorage.getItem(QUICK_NOTES_KEY);
    if (!stored) return [];
    const notes = JSON.parse(stored) as QuickNote[];
    // Sort by createdAt descending (newest first)
    notes.sort((a, b) => b.createdAt - a.createdAt);
    return notes;
  } catch (error) {
    console.error('Failed to load quick notes:', error);
    return [];
  }
}

/**
 * Save all quick notes to storage
 */
export async function saveQuickNotes(notes: QuickNote[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUICK_NOTES_KEY, JSON.stringify(notes));
  } catch (error) {
    console.error('Failed to save quick notes:', error);
    throw error;
  }
}

/**
 * Create a new quick note
 */
export function createQuickNote(text: string): QuickNote {
  const now = Date.now();
  return {
    id: generateUUID(),
    text,
    createdAt: now,
    updatedAt: now,
  };
}
